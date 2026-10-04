import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Scout, guideLead, nextObjective, viaPortal } from '../src/scout.js';
import { makeMaterial, markHero, sharedUniforms } from '../src/materials.js';
const v = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);

test('guide advances through traveler, climb, lenses, return, story, relics and gate', () => {
  const ctx = { player: {pos:v()}, level:{}, story:{done:false,def:{label:'Story'},goal:v(50)}, relics:{items:[{i:1,pos:v(20),done:false}]}, gate:{pos:v(90),destTitle:'Next'} };
  ctx.expedition = {state:{started:false,done:false,returned:false},traveler:{pos:v(10)},model:{center:v(100,51),ledges:[v(126,8),v(124,16)],receivers:[{visible:true},{visible:false}],dials:[new THREE.Object3D(),new THREE.Object3D()]}};
  const goal = () => nextObjective(ctx).id;
  assert.equal(goal(),'traveler');
  ctx.expedition.state.started=true; assert.equal(goal(),'ledge-0');
  ctx.player.pos.y=10; assert.equal(goal(),'ledge-1');
  ctx.player.pos.set(100,51,0); assert.equal(goal(),'lens-1');
  ctx.expedition.state.done=true; assert.equal(goal(),'traveler');
  ctx.expedition.state.returned=true; assert.equal(goal(),'story');
  ctx.story.done=true; assert.equal(goal(),'relic-1');
  ctx.relics.items[0].done=true; assert.equal(goal(),'gate');
  ctx.gate=null; assert.equal(nextObjective(ctx),null);
});

test('route chooses the first of chained portals, but keeps nearby objectives direct', () => {
  const target={id:'goal',label:'Goal',position:v(1000)};
  const links=[{at:v(10),to:v(400)},{pos:v(410),to:v(990)}];
  assert.equal(viaPortal(v(),target,links).position.x,10);
  assert.equal(viaPortal(v(400),target,links).position.x,410);
  assert.equal(viaPortal(v(998),target,links),target);
});

function fixture(physics={rayDistance:()=>Infinity}) {
  const dock=new THREE.Object3D(); dock.position.set(0,2,0);
  const player={pos:v(),vel:v(),frame:{up:v(0,1)},gear:{scoutDock:dock}};
  const scout=new Scout({scene:new THREE.Scene(),player,physics,getTarget:()=>({id:'test',label:'Test',position:v(100)})});
  return {scout,player};
}
test('scout undocks, waits ahead, pauses, refreshes on ping and returns to its dock', () => {
  const {scout}=fixture(); assert.equal(scout.phase,'docked'); scout.ping();
  for(let i=0;i<60;i++)scout.update(.05);
  assert.equal(scout.phase,'guide'); assert.ok(scout.object.position.x>guideLead(0)-1);
  const age=scout.age; scout.update(2,true); assert.equal(scout.age,age);
  scout.ping(); assert.equal(scout.age,0);
  scout.age=4.99; scout.update(.01); assert.equal(scout.phase,'return');
  for(let i=0;i<160;i++)scout.update(.05);
  assert.equal(scout.phase,'docked'); assert.ok(scout.object.position.distanceTo(scout.anchor())<.01);
});
// a wall plane at x = 1 and ground given by heightAt (a stand-in for the BVH and heightfield)
function walled(heightAt=()=>0, wallX=Infinity) {
  return {
    base:{heightAt},
    rayHit(o,d,far){ if(d.x<=1e-6||o.x>=wallX) return null; const t=(wallX-o.x)/d.x; return t<=far?{distance:t,point:o.clone().addScaledVector(d,t),normal:v(-1)}:null; },
  };
}
test('scout slides along walls and asks for a recall when boxed in; teleport recalls it', () => {
  const {scout,player}=fixture(walled(()=>0,1));
  const up=v(0,1),pos=scout.object.position;pos.set(0,2,0);
  let boxed=false;
  for(let i=0;i<120&&!boxed;i++){ boxed=scout.fly(v(10,2),7,up,1/30); assert.ok(pos.x<1,`through the wall: ${pos.x}`); }
  assert.ok(boxed,'a scout pinned against a wall gives up instead of hovering there forever');
  // a whole ping: it blinks back to the dock, relaunches once, then stays home
  scout.dock();scout.ping();let docks=0,was=scout.phase;
  for(let i=0;i<200;i++){scout.update(1/30);assert.ok(pos.x<1);if(scout.phase==='docked'&&was!=='docked')docks++;was=scout.phase;}
  assert.equal(scout.phase,'docked');assert.ok(docks>=1&&docks<=2,`recalls: ${docks}`);
  scout.ping(); player.pos.x=100; scout.update(.01); assert.equal(scout.phase,'docked');
});
test('scout rises over terrain instead of freezing, never dips into it, and moves smoothly', () => {
  // rolling slopes, then a 10 m rise; the destination itself is below the ground
  const ground=x=>Math.sin(x*.6)*1.2+Math.max(0,x-15)*.8;
  const {scout}=fixture(walled(x=>ground(x)));
  const up=v(0,1),pos=scout.object.position;pos.set(0,1.5,0);
  let last=pos.clone(),lastV=scout.vel.clone(),frozen=0;
  for(let i=0;i<360;i++){
    scout.fly(v(30,ground(30)-2,0),7,up,1/60);
    assert.ok(pos.y-ground(pos.x)>=.35-1e-6,`in the ground at ${pos.x.toFixed(2)}: ${(pos.y-ground(pos.x)).toFixed(3)}`);
    const step=pos.distanceTo(last); if(i>20&&pos.x<29&&step<.02) frozen++;
    assert.ok(scout.vel.distanceTo(lastV)<1.2,`velocity jumps (stutter): ${scout.vel.distanceTo(lastV)}`);
    last.copy(pos);lastV.copy(scout.vel);
  }
  assert.equal(frozen,0,'never stalls on a slope');
  assert.ok(pos.x>27,`arrives over the hill: ${pos.x}`);
});
test('scout arrives at a point without ping-ponging around it', () => {
  const {scout}=fixture(walled());
  const up=v(0,1),pos=scout.object.position,goal=v(6,3,2);pos.set(0,2,0);
  let flips=0,prev=null;
  for(let i=0;i<300;i++){
    scout.fly(goal,9,up,1/60);
    const along=scout.vel.dot(goal.clone().sub(v(0,2,0)).normalize());
    if(prev!==null&&Math.sign(along)!==Math.sign(prev)&&Math.abs(along)>.05&&Math.abs(prev)>.05) flips++;
    prev=along;
  }
  assert.ok(flips<=1,`direction flips: ${flips}`);
  assert.ok(pos.distanceTo(goal)<.15,`settles at the goal: ${pos.distanceTo(goal)}`);
});
test('scout gets past a solid block in real level geometry without entering it', async () => {
  const {Physics}=await import('../src/physics.js');
  const scene=new THREE.Scene();
  for(const [x,y,z,w,h,d] of [[5,2,0,2,4,8],[0,-.5,0,100,1,100]]){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d));m.position.set(x,y,z);scene.add(m);}
  const physics=new Physics(scene);
  const {scout}=fixture(physics);
  const up=v(0,1),pos=scout.object.position;pos.set(0,1.5,0);
  let recall=false;
  for(let i=0;i<360;i++){
    recall=scout.fly(v(10,1.5,0),7,up,1/60)||recall;
    assert.ok(!(pos.x>3.85&&pos.x<6.15&&pos.y<4.15&&Math.abs(pos.z)<4.15),`inside the block at ${pos.toArray()}`);
  }
  assert.ok(pos.distanceTo(v(10,1.5,0))<1||recall,`past the block or recalled: ${pos.toArray()}`);
  assert.ok(pos.x>6,`made it over: ${pos.toArray()}`);
});
test('hero tagging isolates cached materials while preserving live scene uniforms', () => {
  const shared=makeMaterial({color:'#aabbcc'}), root=new THREE.Group();
  const a=new THREE.Mesh(new THREE.BoxGeometry(),shared), b=a.clone();root.add(a,b);
  markHero(root);
  assert.equal(shared.uniforms.uHero.value,0);
  assert.equal(a.material,b.material); assert.notEqual(a.material,shared);
  assert.equal(a.material.uniforms.uHero.value,1);
  for(const key of Object.keys(sharedUniforms))assert.equal(a.material.uniforms[key],sharedUniforms[key]);
});

test('scout keeps your pace: it leads further the faster you go, stays near, and points at the goal', () => {
  const {scout,player}=fixture();
  assert.ok(guideLead(30)>guideLead(1.5)&&guideLead(30)<=15);
  scout.getTarget=()=>({id:'far',label:'Far',position:v(5000)});
  scout.ping();
  for(let i=0;i<40;i++)scout.update(1/30);
  player.vel.set(25,0,0);   // on the bike, flat out towards the goal
  let far=0;
  for(let i=0;i<150;i++){ player.pos.addScaledVector(player.vel,1/30); scout.age=1; scout.update(1/30); far=Math.max(far,scout.object.position.distanceTo(player.pos)); }
  assert.equal(scout.phase,'guide','still guiding at speed');
  assert.ok(scout.object.position.x>player.pos.x,'ahead of you, not trailing behind');
  assert.ok(far<guideLead(25)+6,`stays around you: ${far.toFixed(1)} m`);
  // the goal high above: the pointer tilts up at it
  scout.getTarget=()=>({id:'up',label:'Up',position:scout.object.position.clone().add(v(3,40,0))});
  player.vel.set(0,0,0);
  for(let i=0;i<60;i++){ scout.age=1; scout.update(1/30); }
  const nose=new THREE.Vector3(0,0,1).applyQuaternion(scout.object.quaternion);
  assert.ok(nose.y>0.8,`points up at it: ${nose.y.toFixed(2)}`);
  assert.ok(scout.pointer.visible&&scout.trail.samples.length>3,'pointer lit, trail laid');
});
