import { movementScale, stickForMovementScale } from '../src/movement-input.js';
// Input contracts at both handheld and desktop frame rates, using the actual 3D controller.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player, JUMP, JUMP_INPUT } from '../src/player.js';
import { stick } from '../src/controller.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
function actor(owned=[]) {
  const floor={y:0};
  const physics={heightAbove:p=>p.y-floor.y,groundAt:()=>floor.y,rayDistance:()=>Infinity,rayHit:()=>null,pushCapsule:()=>null,groundNormal:()=>V(0,1,0)};
  const p=new Player(physics,{health:false,climb:false});p.has=id=>owned.includes(id);p.pos.set(0,0,0);p.onGround=true;
  return {p,floor};
}
for(const fps of [30,60]) {
  const dt=1/fps;
  test(`${fps}fps: edge grace is a ground jump once, not a double jump or free repeated takeoff`,()=>{
    const {p,floor}=actor(['backpack','doublejump','jetpack']); let doubles=0;p.onDoubleJump=()=>doubles++;
    p.update(dt,{},Math.PI);floor.y=-100;p.update(dt,{},Math.PI);
    p.update(dt,{},Math.PI);p.update(dt,{Space:true},Math.PI);
    assert.ok(p.vel.y>JUMP-2 && !p.onGround);assert.equal(doubles,0);assert.equal(p.jetFlight,null);assert.equal(p.fuel,1);
    assert.equal(p._airJumped,false,'ground grace leaves the owned double jump available');
    p.update(dt,{},Math.PI);p.update(dt,{Space:true},Math.PI);assert.equal(doubles,1,'second distinct press owns the double jump');
    p.update(dt,{},Math.PI);p.update(dt,{Space:true},Math.PI);assert.equal(doubles,1,'no second double jump');
  });
  test(`${fps}fps: late edge press expires; no equipment means no aerial jump`,()=>{
    const {p,floor}=actor();p.update(dt,{},Math.PI);floor.y=-100;
    for(let i=0;i<Math.ceil((JUMP_INPUT.grace+.06)/dt);i++)p.update(dt,{},Math.PI);
    p.update(dt,{Space:true},Math.PI);assert.ok(p.vel.y<0);assert.ok(!p._jumpedNow);
  });
  test(`${fps}fps: a released prelanding press jumps once, then holding does not bounce`,()=>{
    const {p}=actor();p.pos.y=.28;p.vel.y=-4;p.onGround=false;
    p.update(dt,{Space:true},Math.PI);
    let takeoffs=0,last=p.onGround;
    for(let i=0;i<fps*2;i++) {p.update(dt,{},Math.PI);if(last&&!p.onGround)takeoffs++;last=p.onGround;}
    assert.equal(takeoffs,1);assert.ok(p.onGround);assert.equal(p._jumpQueuedUntil,-Infinity);
    p.update(dt,{Space:true},Math.PI);
    for(let i=0;i<fps*2;i++)p.update(dt,{Space:true},Math.PI);
    assert.ok(p.onGround,'holding through landing never schedules another jump');
  });
  test(`${fps}fps: an early landing press expires rather than firing much later`,()=>{
    const {p}=actor();p.pos.y=3;p.vel.y=-1;p.onGround=false;
    p.update(dt,{Space:true},Math.PI);
    for(let i=0;i<fps*2;i++)p.update(dt,{},Math.PI);
    assert.ok(p.onGround);assert.equal(p._groundJumpAt,undefined,'never launched a ground jump');
  });
  test(`${fps}fps: available double jump owns an airborne press; landing cannot spend it again`,()=>{
    const {p}=actor(['backpack','doublejump']);p.pos.y=.28;p.vel.y=-4;p.onGround=false;let doubles=0;p.onDoubleJump=()=>doubles++;
    p.update(dt,{Space:true},Math.PI);assert.equal(doubles,1);assert.equal(p._jumpQueuedUntil,-Infinity);
    for(let i=0;i<fps*2;i++)p.update(dt,{},Math.PI);
    assert.ok(p.onGround);assert.equal(p._groundJumpAt,undefined);
  });
  test(`${fps}fps: held jets consume pending input instead of leaving a landing bounce`,()=>{
    const {p}=actor(['backpack','jetpack']);p.pos.y=3;p.vel.y=-1;p.onGround=false;
    p.update(dt,{Space:true},Math.PI);assert.equal(p.jetFlight,null,'fresh air press is not throttle');
    p.update(dt,{Space:true},Math.PI);assert.ok(p.jetFlight);assert.equal(p._jumpQueuedUntil,-Infinity);assert.equal(p._jumpGroundAt,-Infinity);
  });
  test(`${fps}fps: analog tiny placement is continuous while full-stick and keyboard remain equal`,()=>{
    const distance=(input)=>{const {p}=actor();for(let i=0;i<fps;i++)p.update(dt,input,Math.PI);return p.pos.z;};
    const slow=distance({stick:stick(0,.2)}),medium=distance({stick:stick(0,.4)}),full=distance({stick:stick(0,1)}),keys=distance({KeyW:true});
    assert.ok(slow>0 && slow<.15,`tiny placement ${slow}m`);assert.ok(medium>slow && medium<full*.4);
    assert.ok(Math.abs(full-keys)<1e-8,'full stick matches keyboard');assert.equal(distance({stick:stick(0,.17)}),0,'hardware deadzone still rejects drift');
  });
}

for(const fps of [30,60]) for(const reset of ['teleport','respawn','god']) test(`${fps}fps: ${reset} cannot carry an old ground jump or buffered press`,()=>{
  const {p,floor}=actor();const dt=1/fps;p.update(dt,{},Math.PI);floor.y=-100;
  p.update(dt,{Space:true},Math.PI);p._jumpQueuedUntil=p.time+.12;p._jumpGroundAt=p.time;
  if(reset==='teleport')p.teleport(V(0,10,0),V(0,1,0),V(0,0,1));
  else if(reset==='respawn')p.respawn(V(0,10,0));
  else {p.setGod(true);p.update(dt,{},Math.PI);p.setGod(false);}
  assert.equal(p._jumpQueuedUntil,-Infinity);assert.equal(p._jumpGroundAt,-Infinity);
  p.update(dt,{},Math.PI);p.update(dt,{Space:true},Math.PI);assert.ok(p.vel.y<0,'fresh air press cannot inherit the old floor');
});
for(const fps of [30,60]) test(`${fps}fps: spent double jump can buffer landing then resets for the next airtime`,()=>{
  const {p}=actor(['backpack','doublejump']);const dt=1/fps;p.pos.y=.28;p.vel.y=-4;p.onGround=false;p._airJumped=true;
  p.update(dt,{Space:true},Math.PI);let launched=false;
  for(let i=0;i<10;i++){p.update(dt,{},Math.PI);if(p.vel.y>0){launched=true;break;}}
  assert.ok(launched);assert.equal(p._airJumped,false,'the new airtime has its own earned double');
  let doubles=0;p.onDoubleJump=()=>doubles++;p.update(dt,{Space:true},Math.PI);assert.equal(doubles,1);
});

for(const fps of [30,60])test(`${fps}fps: a conversation/control lock cancels prelanding intent`,()=>{
 const {p}=actor();const dt=1/fps;p.pos.y=.28;p.vel.y=-4;p.onGround=false;
 p.update(dt,{Space:true},Math.PI);p.update(dt,{jumpBlocked:true},Math.PI);
 for(let i=0;i<fps;i++)p.update(dt,{},Math.PI);
 assert.ok(p.onGround);assert.equal(p._groundJumpAt,undefined);
});

for(const fps of [30,60])test(`${fps}fps: a spring launch does not reuse edge grace`,()=>{
 const {p}=actor();const dt=1/fps;p.update(dt,{},Math.PI);p.onGround=false;p.pos.y=2;p.vel.y=20;
 p.update(dt,{Space:true},Math.PI);assert.ok(p.vel.y>18,'spring velocity is not replaced by a ground jump');assert.equal(p._groundJumpAt,undefined);
});


test('fine stick response is continuous, monotone and retains authored middle/full travel pace',()=>{
  assert.equal(movementScale(0),0);assert.equal(movementScale(.04),.04);assert.equal(movementScale(.12),.12);
  for(let i=1;i<=1000;i++) {const current=movementScale(i/1000);assert.ok(Number.isFinite(current)&&current>=0&&current<=1,'finite bounded pace');assert.ok(current>movementScale((i-1)/1000),'more stick always moves faster');}
  assert.equal(movementScale(-1),0);assert.equal(movementScale(2),1);
  for(const k of [.45,.6,.8,1]) assert.ok(Math.abs(movementScale(k)-(.35+.65*k))<1e-12,'established travel pace');
  for(const k of [.12,.45]) {
    const h=1e-6,l=(movementScale(k)-movementScale(k-h))/h,r=(movementScale(k+h)-movementScale(k))/h;
    assert.ok(Math.abs(l-r)<.0001,'the transition has no slope jump');
  }
  for(const scale of [0,.04,.12,.2,.389,.6,1]) assert.ok(Math.abs(movementScale(stickForMovementScale(scale))-scale)<1e-12,'directed walks retain their authored pace');
});
