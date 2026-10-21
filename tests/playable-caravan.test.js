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
    const z=STAIRS.z1-(i+.5)*(STAIRS.z1-STAIRS.z0)/STAIRS.steps, floor=deckAt(STAIRS.x,z);
    assert.ok(Math.abs(physics.groundAt(STAIRS.x,floor+.5,z,1)-floor)<.03,`stair ${i} floor follows walking collision`);
    assert.ok(physics.rayDistance(V(STAIRS.x,floor+.05,z),V(0,1,0),2.1)>2,`stair ${i} standing clearance`);
  }
});
test('bolted furnishings travel rigidly with the deck and pack clear of inhabited rooms',async()=>{
  const m=buildShipModel({caravan:await asset()}),deck=m.authored.getObjectByName('porch-panel');
  const names=['camp-table','camp-seat-left','camp-seat-right','plants','porch-furniture'];
  const rests=new Map();
  m.applyCamp(1,0);m.group.updateMatrixWorld(true);
  for(const name of names) {
    const n=m.authored.getObjectByName(name);assert.ok(n,name);assert.equal(n.parent,deck);
    rests.set(name,n.matrix.clone());
    const bounds=new THREE.Box3().setFromObject(n);
    if(name==='camp-table')assert.ok(Math.abs(bounds.max.y-.104-.89)<.04,'table and secured cups are human scale');
    if(name.startsWith('camp-seat'))assert.ok(bounds.max.y-.104<1.10,'chair back below adult shoulders');
  }
  m.applyCamp(0,4);m.group.updateMatrixWorld(true);
  const railBox=new THREE.Box3().setFromObject(m.authored.getObjectByName('porch-rail'));
  assert.ok(railBox.min.x>-4.4,'folded rail stays behind the closed outer hatch');
  assert.ok(railBox.max.y<6.4,'folded rail fits the hatch height');
  for(let i=0;i<=40;i++) {
    const camp=i/40;m.applyCamp(camp,0);m.group.updateMatrixWorld(true);
    for(const name of names) {
      const n=m.authored.getObjectByName(name);
      assert.deepEqual(n.matrix.elements,rests.get(name).elements,`${name} stays bolted at ${camp}`);
      assert.equal(n.visible,true,`${name} never vanishes`);
      const bounds=new THREE.Box3().setFromObject(n);
      for(const [room,r] of Object.entries(ROOMS)) {
        const left=r.left??r.half,right=r.right??r.half;
        const occupied=new THREE.Box3(V(-left+.11,r.floor+.05,r.z0+.12),V(right-.11,r.ceiling-.05,r.z1-.12));
        assert.ok(!bounds.intersectsBox(occupied),`${name} intrudes into ${room} at camp=${camp}: ${bounds.min.toArray()} / ${bounds.max.toArray()}`);
      }
    }
  }
});
test('camera space has no obsolete overhead garage partitions',async()=>{
  const m=buildShipModel({caravan:await asset()}),physics=new Physics(new THREE.Scene());
  physics.addCollider(m.group);for(const part of m.movingParts)physics.addMover(part);physics.syncMovers(1/60);
  for(const z of [2,7])assert.equal(physics.rayDistance(V(0,4,z),V(1,0,0),3),Infinity,`clear upper camera space at z=${z}`);
  assert.equal(physics.rayDistance(V(0,4,0),V(0,0,1),3),Infinity,'no floating garage end wall');
});
test('caravan navigation globe uses its one-metre contract without changing the original ship',async()=>{
  const {HoloTable}=await import('../src/ship/holotable.js');
  const c=buildShipModel({caravan:await asset()}),old=buildShipModel();
  const globe=new HoloTable(c,'desert'),original=new HoloTable(old,'desert');
  assert.equal(globe.body.material.uniforms.uBody.value.getHexString(),'70c9c5');
  assert.equal(globe.face.scale.x,.5);assert.equal(original.face.scale.x,.3);
  assert.equal(globe.group.position.y,1.1);assert.equal(c.interior.table.r,.225);
  globe.group.updateMatrixWorld(true);
  const size=new THREE.Box3().setFromObject(globe.group).getSize(V());
  assert.ok(size.x<=1.001&&size.y<=1.001&&size.z<=1.001,`entire projection fits 1m: ${size.toArray()}`);
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
  assert.equal(count,6);
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
  walk(V(STAIRS.x,.05,-2.8),V(STAIRS.x,0,-13.0),ROOMS.cockpit.floor);
  walk(V(STAIRS.x,ROOMS.cockpit.floor+.05,-13),V(STAIRS.x,0,-2.8),0);
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

test('lower grounded stance keeps authored rooms fixed and all six feet on uneven terrain',async()=>{
  const { LIFT, AUTHORED_OFFSET, BELLY, undersideAt }=await import('../src/ship/caravan-layout.js');
  assert.equal(LIFT,2.8);assert.ok(Math.abs(AUTHORED_OFFSET-4.68)<1e-10);
  const a=await asset();assert.equal(a.getObjectByName('hull').userData.playableContract.landedDeck,LIFT);
  const flat=buildShipModel({caravan:a});flat.group.position.y=LIFT;flat.group.updateMatrixWorld(true);
  const hull=new THREE.Box3().setFromObject(flat.authored.getObjectByName('hull'));
  assert.ok(hull.min.y>.55&&hull.min.y<.65,`actual belly clearance ${hull.min.y}`);
  assert.ok(BELLY<=hull.min.y-LIFT,'parking envelope conservatively contains actual hull');
  assert.equal(undersideAt(0,0),BELLY);
  assert.ok(flat.interior.points.seat.equals(V(-1.3,5.65,-18.25)),'interior anchor remains ship local');
  const contacts=[];flat.authored.traverse(n=>{if(n.userData.caravanFoot)contacts.push(n);});
  assert.equal(contacts.length,6,'four legs and two independently grounded porch supports');
  for(const foot of contacts){const b=new THREE.Box3().setFromObject(foot);assert.ok(Math.abs(b.min.y)<.08,`${foot.name} flat contact ${b.min.y}`);}
  const slope=p=>-LIFT+.025*p.x+.012*p.z;
  const m=buildShipModel({caravan:a,footY:slope});m.group.updateMatrixWorld(true);
  m.authored.traverse(n=>{
    if(!n.userData.caravanFoot)return;
    const at=authoredToShip(V(...n.userData.caravanFoot.at));
    const b=new THREE.Box3().setFromObject(n);
    assert.ok(Math.abs(b.min.y-slope(at))<.08,`${n.name} follows terrain: ${b.min.y} vs ${slope(at)}`);
  });
  for(const camp of [1,.8,.5,0,.5,1]) {m.applyCamp(camp,0);m.group.updateMatrixWorld(true);}
  m.authored.traverse(n=>{
    if(!n.userData.caravanFoot)return;
    const at=authoredToShip(V(...n.userData.caravanFoot.at)), b=new THREE.Box3().setFromObject(n);
    assert.ok(Math.abs(b.min.y-slope(at))<.08,`${n.name} restores its terrain contact after a full stow cycle`);
  });
  assert.equal(flat.hull.feet.length,4);
  for(const foot of flat.hull.feet)assert.ok(Math.abs(foot.y+LIFT)<1e-5,'reported feet use fitted sole height');
  m.applyCamp(0,4);assert.equal(m.authored.getObjectByName('porch-supports').visible,false);assert.equal(m.authored.getObjectByName('landing-gear').visible,false);
});

test('rounded caravan centres its aft pods inside the Space City pier without turning the boarding ramp',async()=>{
 const {findShipSite}=await import('../src/ship/sites.js');
 const layout=await import('../src/ship/caravan-layout.js');
 const level={shipSite:{x:0,z:128,heading:Math.PI},spawn:V(4,0,110)};
 const physics={groundAt:()=>0,rayDistance:()=>Infinity};
 const old=findShipSite({level,physics,levelId:'spacecity'});
 const next=findShipSite({level,physics,levelId:'spacecity',layout});
 assert.equal(old.x,0);assert.equal(next.x,5);assert.equal(next.z,128);assert.equal(next.heading,Math.PI);
 assert.equal(level.shipSite.x,0,'placement does not mutate the world definition');
});


test('expanded rooms retain clear floors and close the cockpit service cavities', async()=>{
  const m=buildShipModel({caravan:await asset()});m.group.updateMatrixWorld(true);
  const ph=new Physics(new THREE.Scene());ph.addCollider(m.group);
  // Samples in the recovered floor strips, beyond the former 3.1/2.5 m room walls.
  for(const p of [V(5.1,.1,3.8),V(4,.1,9.8),V(3.6,.1,15.8),V(4,.1,-9),V(4,.1,-.4),V(-3.5,.1,5.2),V(3.3,.1,6),V(-2.5,.1,10.7),V(2.4,.1,15.2)]) {
    assert.ok(Math.abs(ph.groundAt(p.x,p.y+.5,p.z,1))<.03,`floor at ${p.toArray()}`);
    assert.ok(ph.rayDistance(p,V(0,1,0),2.2)>2.1,`usable headroom at ${p.toArray()}`);
  }
  for(const x of [-4,2,4]) {
    const hit=ph.rayDistance(V(x,7,-14),V(0,0,1),5);
    assert.ok(hit>1.7&&hit<2.2,`cockpit rear enclosure at x=${x}: ${hit}`);
  }
  assert.ok(ph.rayDistance(V(3,1.6,-10),V(0,0,-1),4)<2.1,'lower forward bulkhead closes the cavity below the cockpit');
});
test('wake and message sightlines face the observation window without a screen in the face', async()=>{
  const m=buildShipModel({caravan:await asset()});m.group.updateMatrixWorld(true);
  const p=m.interior.points, forward=V(Math.sin(p.bunkStandHeading),0,Math.cos(p.bunkStandHeading));
  assert.ok(forward.dot(p.voicemail.clone().sub(p.bunkStand).setY(0).normalize())>.99,'stand faces the blinking message');
  const eye=p.cockpit.clone().add(V(0,1.7,0));
  const ray=new THREE.Raycaster(eye,V(1,0,0),0,10);
  const hits=ray.intersectObject(m.authored,true);
  assert.equal(hits.length,0,`real outside view from message, blocked by ${hits.map(x=>x.object.name)}`);
  assert.ok(Math.abs(m.interior.screen.centre.z-p.projector.z)-m.interior.screen.radius>.35,'date screen is beside the bust, not on its viewing axis');
  const ph=new Physics(new THREE.Scene());ph.addCollider(m.group);
  assert.ok(ph.rayDistance(eye,V(1,0,0),10)<5,'window still contains player and camera collision');
});

test('caravan follow camera stays inside its finished rooms during full turns', async()=>{
  const {CameraRig}=await import('../src/player.js');
  const m=buildShipModel({caravan:await asset()});m.group.updateMatrixWorld(true);
  const ph=new Physics(new THREE.Scene());ph.addCollider(m.group);
  const camera=new THREE.PerspectiveCamera(65,16/9,.3,5000);
  const rig=new CameraRig(camera,{addEventListener(){}},ph);rig.indoor=true;
  const points=[m.interior.points.bunkStand,m.interior.points.cockpit,V(0,0,7),V(0,0,13.2),V(STAIRS.x,deckAt(STAIRS.x,-10.3),-10.3),V(0,5.2,-16.2),V(STAIRS.x,5.2,-12.4)];
  for(const p of points){
    rig.pitch=.1;rig.target.copy(p);rig.snapTight(p);
    for(let i=0;i<40;i++)rig.update(p,1/60);
    let clipped=0;
    for(let i=0;i<240;i++){
      rig.look(-(Math.PI*2/240)/.0025,0);rig.update(p,1/60);
      const f=camera.getWorldDirection(V(0,0,0));let bad=false;
      for(const x of [-1,0,1])for(const y of [-1,0,1])for(const z of [-1,0,1]){
        if(!x&&!y&&!z)continue;const d=V(x,y,z).normalize();
        if(d.dot(f)>-.2&&ph.rayDistance(camera.position,d,.3)<.3)bad=true;
      }
      if(bad)clipped++;
    }
    assert.ok(clipped<=4,`lens clearance at ${p.toArray()}: ${clipped}/240 frames`);
  }
});
