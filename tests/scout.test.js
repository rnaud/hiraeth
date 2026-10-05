import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Scout, nextObjective, viaPortal, FIND, HINT, FLARE, Flare, roughDistance, findText } from '../src/scout.js';
import { makeMaterial, markHero, sharedUniforms } from '../src/materials.js';
const v = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);

test('what the scout finds: the traveler, the climb, the lenses, the return, the story, then the ship; never a relic', () => {
  const ctx = { player: {pos:v()}, level:{}, story:{done:false,def:{label:'Story'},goal:v(50)}, relics:{items:[{i:1,pos:v(20),done:false}]}, ship:{pos:v(90)} };
  ctx.expedition = {state:{started:false,done:false,returned:false},traveler:{pos:v(10)},model:{center:v(100,51),ledges:[v(126,8),v(124,16)],receivers:[{visible:true},{visible:false}],dials:[new THREE.Object3D(),new THREE.Object3D()]}};
  const goal = () => nextObjective(ctx).id;
  assert.equal(goal(),'traveler');
  ctx.expedition.state.started=true; assert.equal(goal(),'ledge-0');
  ctx.player.pos.y=10; assert.equal(goal(),'ledge-1');
  ctx.player.pos.set(100,51,0); assert.equal(goal(),'lens-1');
  ctx.expedition.state.done=true; assert.equal(goal(),'traveler');
  ctx.expedition.state.returned=true; assert.equal(goal(),'story');
  ctx.story.done=true; assert.equal(goal(),'ship','the world told: on to the ship (the relics are yours to find)');
  ctx.player.pos.set(80,0,0); assert.equal(nextObjective(ctx),null,'at the ship already: nothing to find');
  ctx.player.pos.set(0,0,0); ctx.ship=null; assert.equal(nextObjective(ctx),null);
});

test('the scout finds the right objective in each kind of world', () => {
  const player={pos:v()}, story={done:false,def:{label:'The silent tower'},goal:v(300)}, ship={pos:v(-40)};
  const quest={id:'quest-desert.power-sel',label:'Madame Sel, under the silent tower',position:v(320)};
  // a world told step by step: the tracked (or main) quest's next step comes first
  assert.equal(nextObjective({player,story,ship,level:{},quest:()=>quest}).label,'Madame Sel, under the silent tower');
  // a world with no step-by-step quest: its story goal (the beacon)
  assert.equal(nextObjective({player,story,ship,level:{},quest:()=>null}).label,'The silent tower');
  // the observatory under way wins over a quest (the lenses are what is in front of you)
  const expedition={state:{started:true,done:false,returned:false},traveler:{pos:v(10)},model:{center:v(0,51,0),ledges:[v(26,8)],receivers:[{visible:false}],dials:[new THREE.Object3D()]}};
  assert.equal(nextObjective({player,story,ship,level:{},quest,expedition}).id,'ledge-0');
  // through a doorway when it is shorter (the cave, a gravity portal)
  const o=nextObjective({player,story,ship,level:{portals:[{at:v(5),to:v(299),label:'cave mouth'}]},quest:()=>null});
  assert.equal(o.label,'Through the cave mouth');
  // the toast: what it found and roughly how far
  assert.equal(findText(quest,318),'Madame Sel, under the silent tower · 320 m');
  assert.equal(roughDistance(7.4),'7 m'); assert.equal(roughDistance(1430),'1.4 km');
});

test('route chooses the first of chained portals, but keeps nearby objectives direct', () => {
  const target={id:'goal',label:'Goal',position:v(1000)};
  const links=[{at:v(10),to:v(400)},{pos:v(410),to:v(990)}];
  assert.equal(viaPortal(v(),target,links).position.x,10);
  assert.equal(viaPortal(v(400),target,links).position.x,410);
  assert.equal(viaPortal(v(998),target,links),target);
});

function fixture(physics={rayDistance:()=>Infinity}, target=v(100)) {
  const dock=new THREE.Object3D(); dock.position.set(0,2,0);
  const player={pos:v(),vel:v(),frame:{up:v(0,1)},gear:{scoutDock:dock}};
  const finds=[], shrugs=[];
  const scout=new Scout({scene:new THREE.Scene(),player,physics,getTarget:()=>target&&({id:'test',label:'Test',position:target}),onFind:(t,d)=>finds.push([t.label,d]),onShrug:()=>shrugs.push(1)});
  return {scout,player,finds,shrugs};
}
const forward=(scout)=>new THREE.Vector3(0,0,1).applyQuaternion(scout.object.quaternion);
test('ping: the scout flies a little way towards the objective, hovers facing it (no second pointer: no beak, no beam), drops a flare, comes home and docks', () => {
  const {scout,finds}=fixture(); assert.equal(scout.phase,'docked'); scout.ping();
  const seen=new Set(); let beamAt=0, farthest=0, flareSeen=false, facing=-1;
  assert.equal(scout.pointer,undefined,'no beak on the drone');
  for(let i=0;i<60*12;i++){
    scout.update(1/60); seen.add(scout.phase);
    farthest=Math.max(farthest,scout.object.position.x);
    if(scout.phase==='point'){ beamAt=Math.max(beamAt,scout.beamLen); facing=Math.max(facing,forward(scout).x); }
    if(scout.flare.on) flareSeen=true;
  }
  assert.deepEqual([...seen],['launch','seek','point','return','docked']);
  assert.ok(farthest>FIND.out-1.5&&farthest<FIND.out+1.5,`a little way towards it (${farthest.toFixed(1)} m), not all the way`);
  assert.equal(beamAt,0,'no beam: the drone itself points the way');
  assert.ok(facing>0.9,`it faces the objective: ${facing.toFixed(2)}`);
  assert.ok(flareSeen,'a flare on the spot');
  assert.deepEqual(finds,[['Test',100]],'found once: the toast names it and how far');
  assert.equal(scout.phase,'docked'); assert.ok(scout.object.position.distanceTo(scout.anchor())<.01,'back on its dock');
  assert.equal(scout.beam.visible,false,'the beam off');
  // the flare fades on its own
  assert.equal(Flare.k(FLARE.life+0.1),0); assert.ok(Flare.k(FLARE.life/2)>0.99); assert.equal(Flare.k(0),0);
  // paused (a menu): nothing moves
  scout.ping(); for(let i=0;i<30;i++)scout.update(1/60);
  const age=scout.age, at=scout.object.position.clone(); scout.update(2,true);
  assert.equal(scout.age,age); assert.ok(scout.object.position.equals(at));
  // pressed again while out: it starts over
  scout.ping(); assert.equal(scout.age,0);
});
test('a near objective: the scout flies right over it and points down at it', () => {
  const {scout,finds}=fixture(undefined,v(6,0,3));
  scout.ping();
  for(let i=0;i<60*3.5;i++)scout.update(1/60);
  assert.equal(scout.phase,'point');
  assert.ok(Math.hypot(scout.object.position.x-6,scout.object.position.z-3)<1,`over it: ${scout.object.position.toArray().map(x=>x.toFixed(1))}`);
  assert.ok(forward(scout).y<-0.3,`nose down at it: ${forward(scout).y.toFixed(2)}`);
  assert.equal(finds.length,1);
});
test('nothing to find: the scout shrugs on its dock (a hop and a shake), says so, and stays home', () => {
  const {scout,finds,shrugs}=fixture(undefined,null);
  assert.equal(scout.ping(),false);
  assert.equal(scout.phase,'shrug'); assert.equal(shrugs.length,1);
  let far=0, turned=0; const q0=scout.dockQuaternion();
  for(let i=0;i<60*1.5;i++){ scout.update(1/60); far=Math.max(far,scout.object.position.distanceTo(scout.anchor())); turned=Math.max(turned,scout.object.quaternion.angleTo(q0)); }
  assert.equal(scout.phase,'docked');
  assert.ok(far>0.02&&far<0.1,`a little hop off the dock: ${far.toFixed(3)} m`);
  assert.ok(turned>0.2,`a shake: ${turned.toFixed(2)} rad`);
  assert.equal(finds.length,0);
  assert.equal(scout.fold.petals,0,'it never opened');
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

test('scout keeps your pace riding: it looks out ahead of you, stays near, and points at the goal', () => {
  const {scout,player}=fixture();
  scout.getTarget=()=>({id:'far',label:'Far',position:v(5000)});
  scout.ping();
  for(let i=0;i<40;i++)scout.update(1/30);
  player.vel.set(25,0,0);   // on the bike, flat out towards the goal
  let far=0;
  for(let i=0;i<150;i++){ player.pos.addScaledVector(player.vel,1/30); scout.age=1; if(scout.phase==='point')scout.pointT=0; scout.update(1/30); far=Math.max(far,scout.object.position.distanceTo(player.pos)); }
  assert.ok(scout.phase==='seek'||scout.phase==='point','still out at speed');
  assert.ok(scout.object.position.x>player.pos.x,'ahead of you, not trailing behind');
  assert.ok(far<FIND.out+25*0.4+8,`stays around you: ${far.toFixed(1)} m`);
  // the goal high above: the drone tilts up at it
  scout.getTarget=()=>({id:'up',label:'Up',position:scout.object.position.clone().add(v(3,40,0))});
  player.vel.set(0,0,0);
  for(let i=0;i<60;i++){ scout.age=1; if(scout.phase==='point')scout.pointT=0; scout.update(1/30); }
  // (the body stays near level, a drone: it noses up as far as it can)
  assert.ok(forward(scout).y>0.3,`nose up at it: ${forward(scout).y.toFixed(2)}`);
  const body=new THREE.Vector3(0,1,0).applyQuaternion(scout.object.quaternion);
  assert.ok(body.y>Math.cos(0.75),`the body near level: ${body.y.toFixed(2)}`);
  assert.ok(scout.trail.samples.length>3,'trail laid');
});

test('in a guardian\'s fight a ping is a hint: the lens beam on the weak point, a chirp, the line, plainer each time, no flare', () => {
  const weak=v(9,4,0); let hint={id:'incal.0',lines:['nudge','plainer','plainest'],at:()=>weak};
  const dock=new THREE.Object3D(); dock.position.set(0,2,0);
  const player={pos:v(),vel:v(),frame:{up:v(0,1)},gear:{scoutDock:dock}};
  const said=[], finds=[], chirps=[];
  const scout=new Scout({scene:new THREE.Scene(),player,physics:{rayDistance:()=>Infinity},sound:{drone:(k)=>chirps.push(k)},
    getTarget:()=>({id:'quest',label:'Quest',position:v(200)}),getHint:()=>hint,onFind:(t)=>finds.push(t.label),onHint:(line,n)=>said.push([line,n])});
  const run=(secs)=>{ let beam=0, far=0; for(let i=0;i<60*secs;i++){ scout.update(1/60); beam=Math.max(beam,scout.beamLen); far=Math.max(far,scout.object.position.distanceTo(player.pos)); } return {beam,far}; };
  scout.ping();
  const r=run(10);
  assert.deepEqual(said,[['nudge',0]],'the first line, once it is out');
  assert.ok(chirps.includes('hint'),'its own chirp');
  assert.equal(finds.length,0,'not a find');
  assert.equal(scout.flare.on,false,'no flare on a guardian');
  const toWeak=weak.distanceTo(v(0,HINT.rise,0));
  assert.ok(r.beam>toWeak-3,`the lens beam reaches the weak point (${r.beam.toFixed(1)} of ${toWeak.toFixed(1)} m)`);
  assert.ok(r.far<HINT.out+HINT.rise+2,`it stays by you: ${r.far.toFixed(1)} m`);
  assert.equal(scout.phase,'docked','and comes home');
  scout.ping(); run(8); scout.ping(); run(8); scout.ping(); run(8);
  assert.deepEqual(said.map(([l])=>l),['nudge','plainer','plainest','plainest'],'asked again: plainer, then the plainest stays');
  // a new phase starts over
  hint={...hint,id:'incal.1',lines:['crown']}; scout.ping(); run(8);
  assert.equal(said.at(-1)[0],'crown');
  // the weak point moves: the beam follows it
  scout.ping(); for(let i=0;i<60*3.2;i++) scout.update(1/60);
  weak.set(-9,4,0); for(let i=0;i<60*0.8;i++) scout.update(1/60);
  assert.equal(scout.phase,'point'); assert.ok(scout.target.position.x<-8,'it follows the weak point');
  // the fight over (no hint): a ping finds the objective again
  hint=null; run(8); scout.ping(); run(10);
  assert.deepEqual(finds,['Quest']);
});

test('with the game\'s physics (a capsule sweep each step) the drone still faces what it found, and a hint\'s beam still points at the weak point', () => {
  // (the capsule sweep writes its push into a scratch vector: the aim must not share it)
  const physics={rayDistance:()=>Infinity,pushCapsule:()=>null};
  const {scout}=fixture(physics,v(0,0,100)); scout.ping();
  let facing=-1; for(let i=0;i<60*5;i++){ scout.update(1/60); if(scout.phase==='point') facing=Math.max(facing,new THREE.Vector3(0,0,1).applyQuaternion(scout.object.quaternion).z); }
  assert.ok(facing>0.9,`it faces the objective (+z): ${facing.toFixed(2)}`);
  const weak=v(-8,6,3);
  const dock=new THREE.Object3D(); dock.position.set(0,2,0);
  const player={pos:v(),vel:v(),frame:{up:v(0,1)},gear:{scoutDock:dock}};
  const s2=new Scout({scene:new THREE.Scene(),player,physics,getTarget:()=>null,getHint:()=>({id:'x.0',lines:['look'],at:()=>weak})});
  s2.ping(); for(let i=0;i<60*3;i++) s2.update(1/60);
  assert.equal(s2.phase,'point');
  s2.object.updateMatrixWorld(true);
  const from=s2.lens.getWorldPosition(new THREE.Vector3()), along=new THREE.Vector3(0,0,1).applyQuaternion(s2.lens.getWorldQuaternion(new THREE.Quaternion()));
  const want=weak.clone().sub(from).normalize();
  assert.ok(along.dot(want)>0.97,`the beam on the weak point: ${along.dot(want).toFixed(3)}`);
});
