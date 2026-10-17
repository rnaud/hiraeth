import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
await import('./register-gadgets.js');
const { loadWorld } = await import('./playthrough-agent.js');
const { Player } = await import('../src/player.js');
const { QUARTER, CLEFT, COURT, placed } = await import('../src/glass-dunes-quarter.js');
const { FOLDED, PRISM, PEARL } = await import('../src/glass-dunes-west.js');
/** A point of the court in its own frame (built facing +z about its anchor), where it stands. */
const court = placed(COURT);
let W;
const world=()=>W??=(globalThis.location={search:'?level=glassdunes'},loadWorld('glassdunes'));
test.after(()=>W?.dispose());
function walk(from,to) {
  const P=new Player(world().physics,{health:false}); P.pos.set(...from); P.onGround=true;
  const target=new THREE.Vector3(...to);
  const frames=Math.max(1800,Math.ceil(target.distanceTo(P.pos)*30));
  for(let i=0;i<frames;i++) {
    const yaw=Math.atan2(target.x-P.pos.x,target.z-P.pos.z); P.heading=yaw;
    P.update(1/60,{KeyW:true},yaw+Math.PI);
    if(Math.hypot(P.pos.x-target.x,P.pos.z-target.z)<0.7&&Math.abs(P.pos.y-target.y)<0.7) return;
  }
  assert.fail(`walk ${from} -> ${to} stopped at ${P.pos.toArray()}`);
}
test('new stairs and winding terrace routes are walkable both ways',async(t)=>{
 for(const [n,s] of world().level.quarter.stairs.entries()) await t.test(`flight ${n}`,()=>{const points=s.via??[s.from,s.to];for(let i=1;i<points.length;i++){walk(points[i-1],points[i]);walk(points[i],points[i-1]);}});
});
test('stairhead landings connect to the terraces and the cleft ground lane stays open',()=>{
 const {level}=world();for(const [a,b] of level.quarter.landings){walk(a,b);walk(b,a);}
 walk([CLEFT.x,level.ground.heightAt(CLEFT.x,CLEFT.z+32),CLEFT.z+32],[CLEFT.x,level.ground.heightAt(CLEFT.x,CLEFT.z-30),CLEFT.z-30]);
});
test('the village has a continuous walk from the sand to the highest terrace',()=>{
 for(const [a,b] of world().level.quarter.journey){walk(a,b);walk(b,a);}
});
test('the ruined court has an open vaulted passage',()=>{
 const H=(x,z)=>world().level.ground.heightAt(x,z),x=COURT.x-14.3;
 const a=court(x,0,COURT.z+1),b=court(x,0,COURT.z-14);
 walk([a[0],H(a[0],a[2]),a[2]],[b[0],H(b[0],b[2]),b[2]]);
});
test('the ruined courtyard is roofed from inside, with an open cave entrance',()=>{
 const {level}=world(),cave=level.quarter.cave,base=level.ground.heightAt(COURT.x,COURT.z);
 cave.updateMatrixWorld(true);
 for(const dx of [-12,0,12])for(const dz of [-20,0,12]){
  const [x,,z]=court(COURT.x+dx,0,COURT.z+dz);
  const ray=new THREE.Raycaster(new THREE.Vector3(x,base+22,z),new THREE.Vector3(0,1,0),0,140);
  const hit=ray.intersectObject(cave,false)[0];
  assert.ok(hit,`cave roof missing at ${dx},${dz}`);
  assert.ok(hit.face.normal.clone().transformDirection(cave.matrixWorld).y<0,`roof must face into the cave at ${dx},${dz}`);
 }
 const [ox,,oz]=court(COURT.x,0,COURT.z+36);
 const outside=new THREE.Raycaster(new THREE.Vector3(ox,base+2,oz),new THREE.Vector3(0,1,0),0,60);
 assert.equal(outside.intersectObject(cave,false).length,0,'the mouth opens onto the dunes');
 const [ix,,iz]=court(COURT.x,0,COURT.z+10);
 walk([ox,level.ground.heightAt(ox,oz),oz],[ix,level.ground.heightAt(ix,iz),iz]);
});
test('buried city keeps its exit route and has a walkable gallery loop',()=>{
 const a=[620,2600,-620]; const p=(x,y,z)=>[a[0]+x,a[1]+y,a[2]+z];
 walk(p(-18,0,27),p(-18,4,14));walk(p(-18,4,14),p(-10,4,14));walk(p(-10,4,14),p(-10,0,27));
});
test('new scenery stays away from the main quest, temple and people',()=>{
 const {level,npcs}=world();
 assert.deepEqual(level.flowMound,[70,140]);
 for(const p of [[24,228],[70,140],[118,72],[-126,30],[10,-192],[88,84]])for(const scenery of [level.quarter,level.western])assert.equal(scenery.avoid(...p,3),false,`protected site ${p}`);
 assert.ok(npcs.length>0);
 for(const o of [QUARTER,CLEFT,COURT]) assert.ok(level.quarter.avoid(o.x,o.z));
});

test('new glass and buildings leave the existing slalom centreline clear',async()=>{
 const {TRIALS}=await import('../src/trials/data.js');
 const gates=TRIALS.glassdunes.gates, meshes=[];
 world().level.quarter.group.updateMatrixWorld(true);
 world().level.quarter.group.traverse(o=>{if(o.isMesh&&!o.userData.noCollide)meshes.push(o);});
 world().level.western.group.updateMatrixWorld(true);
 world().level.western.group.traverse(o=>{if(o.isMesh&&!o.userData.noCollide)meshes.push(o);});
 for(let i=1;i<gates.length;i++) for(const dy of [-1,0,1]) {
  const a=new THREE.Vector3(...gates[i-1].slice(0,3)), b=new THREE.Vector3(...gates[i].slice(0,3)); a.y+=dy;b.y+=dy;
  const delta=b.clone().sub(a), ray=new THREE.Raycaster(a,delta.clone().normalize(),0,delta.length());
  assert.equal(ray.intersectObjects(meshes,false).length,0,`slalom leg ${i}, height offset ${dy}`);
 }
});

test('western ravines and pearl city have real, walkable stairs and bridge decks',async(t)=>{
 const {western}=world().level;
 for(const [n,route] of western.routes.entries())await t.test(`western stair ${n}`,()=>{
  const points=route.via;
  for(let i=1;i<points.length;i++){walk(points[i-1],points[i]);walk(points[i],points[i-1]);}
 });
 for(const [n,[a,b]] of western.walks.entries())await t.test(`western connection ${n}`,()=>{walk(a,b);walk(b,a);});
});
test('buried street upper crossings can be reached and returned from',()=>{
 const {streets}=world().level.sandCity.city;
 const p=v=>[v[0]+620,v[1]+2600,v[2]-620];
 for(const route of streets.routes)for(let i=1;i<route.via.length;i++){walk(p(route.via[i-1]),p(route.via[i]));walk(p(route.via[i]),p(route.via[i-1]));}
 for(const [a,b] of streets.walks){walk(p(a),p(b));walk(p(b),p(a));}
});

test('the far west is a loop: round by the red cleft, or through the giants\' passage, on to the pearl city and back by the gap',()=>{
 const {level}=world(),p=(x,z)=>[x,level.ground.heightAt(x,z),z],go=(route)=>{for(let i=1;i<route.length;i++){walk(route[i-1],route[i]);walk(route[i],route[i-1]);}};
 // from the ship, west round the giants' south end, up the red cleft and out by its arch, into the ravine's south mouth
 go([p(0,226),p(-60,288),p(-150,300),p(-196,322),p(CLEFT.x,CLEFT.z+56),p(CLEFT.x,CLEFT.z+40),p(CLEFT.x,CLEFT.z),p(CLEFT.x+1,CLEFT.z-52),p(CLEFT.x+1,CLEFT.z-64),p(FOLDED.x,CLEFT.z-64),p(FOLDED.x,FOLDED.z+60)]);
 // down the ravine to the square at its north mouth, where the giants' passage comes out
 go([p(FOLDED.x,FOLDED.z+60),p(FOLDED.x,FOLDED.z),p(FOLDED.x,FOLDED.z-82),p(-300,34)]);
 go([p(-160,69.8),p(-245,68.3),p(-270,38),p(-300,34)]);
 // through the prism crossings, under the crystal arch, to the pearl city's stair
 go([p(-300,34),p(PRISM.x,PRISM.z+70),p(PRISM.x,PRISM.z),p(PRISM.x,PRISM.z-80),level.western.pearl.entry]);
 // and out of the pearl city east, through the gap between the giants and the breaker, to the north camp
 const out=level.western.pearl.exit;
 go([out,p(-240,-205),p(-170,-185),p(-60,-180),p(10,-180)]);
 const base=level.western.pearl.base;
 const lane=[level.western.pearl.entry,[PEARL.x,base,PEARL.z+39],[PEARL.x-22,base,PEARL.z+32],[PEARL.x-30,base,PEARL.z+26]];
 go(lane);
});

test('prism walls face into the ravine on both sides',()=>{
 const group=world().level.western.group;group.updateMatrixWorld(true);
 for(const side of [-1,1]){
  const ray=new THREE.Raycaster(new THREE.Vector3(PRISM.x,38,PRISM.z),new THREE.Vector3(side,0,0),0,36);
  const hit=ray.intersectObject(group,true)[0];
  assert.ok(hit,`missing prism wall on side ${side}`);
  assert.ok(hit.face.normal.x*side<0,`wall must face into the cleft on side ${side}`);
 }
});

test('the enlarged courtyard arch stays open at two-storey height',()=>{
 const {level}=world(),base=level.ground.heightAt(COURT.x,COURT.z);
 level.quarter.group.updateMatrixWorld(true);
 const a=court(COURT.x-14.3,0,COURT.z+12),b=court(COURT.x-14.3,0,COURT.z-15),dir=new THREE.Vector3(b[0]-a[0],0,b[2]-a[2]).normalize();
 const ray=new THREE.Raycaster(new THREE.Vector3(a[0],base+15,a[2]),dir,0,27);
 assert.equal(ray.intersectObject(level.quarter.group,true).length,0,'window holes must not close or tear the tall arch');
 const [ux,,uz]=court(COURT.x,0,COURT.z-20);
 const up=new THREE.Raycaster(new THREE.Vector3(ux,base+22,uz),new THREE.Vector3(0,1,0));
 assert.ok(up.intersectObject(level.quarter.cave,false)[0].point.y>base+65,'the city-scale ruins fit inside a taller cavern');
});

test('the folded stair reaches its high glass summit and pearl houses have no intact roofs',()=>{
 const {western}=world().level;
 assert.ok(western.folded.summit[1]-western.folded.base>100);
 assert.ok(western.folded.stairMaterial.defines.DUNE_GLASS,'pale stairs use the shared glass shader');
 western.group.traverse(o=>{if(o.isMesh&&o.material===western.folded.stairMaterial){assert.equal(o.geometry.attributes.aGlass?.count,o.geometry.attributes.position.count,'glass data survives merging for Unity');assert.equal(o.geometry.attributes.aGlass.getX(0),100);}});
 const route=western.routes.find(r=>r.to===western.folded.summit);
 assert.ok(route,'the summit belongs to a tested walkable stair');
 western.group.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(PEARL.x-23,western.pearl.base+30,PEARL.z+22),new THREE.Vector3(0,-1,0));
 const hit=ray.intersectObject(western.group,true)[0];
 assert.ok(hit&&hit.point.y<western.pearl.base+2,'the empty ruined shell is open to the sky');
});

test('buried streets have tall solid facades, emissive windows and a higher roof',async()=>{
 const {CITY,cityPoint,inCity}=await import('../src/glass-dunes-city.js');
 const {city}=world().level.sandCity;city.group.updateMatrixWorld(true);
 const roof=new THREE.Raycaster(cityPoint(6,20,0),new THREE.Vector3(0,1,0),0,70).intersectObject(city.group,true)[0];
 assert.ok(roof&&roof.point.y-CITY.at[1]>60,'vault clears the upper floors');
 const tower=new THREE.Raycaster(cityPoint(-29,65,-1),new THREE.Vector3(0,-1,0),0,65).intersectObject(city.group,true)[0];
 assert.ok(tower&&tower.point.y-CITY.at[1]>40,'street buildings rise well above the original gallery');
 assert.ok(city.streets.windowMaterial.uniforms.uGlow.value>1,'windows emit light through the shared surface shader');
 assert.ok(inCity(cityPoint(-29,50,-1)),'upper floors stay inside the buried-city lighting region');
});
