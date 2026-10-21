import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player } from '../src/player.js';
import { Physics } from '../src/physics.js';
const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
function platform() {
  const physics = new Physics(new THREE.Scene());
  const deck = new THREE.Mesh(new THREE.BoxGeometry(12, 1, 12));
  deck.position.y = 4.5;
  physics.addMover(deck); physics.syncMovers(0);
  const player = new Player(physics, {health:false,climb:false});
  player.has = () => false;
  player.pos.set(0,5,0); player.onGround=true;
  return {physics,deck,player};
}
for (const fps of [30,60,120]) for (const velocity of [-3,3]) {
  test(`moving deck ${velocity} m/s at ${fps} fps keeps grounded feet on its surface`, () => {
    const {physics,deck,player:p}=platform(), dt=1/fps;
    for(let i=0;i<fps;i++) {
      deck.position.y+=velocity*dt; deck.position.x+=dt;
      physics.syncMovers(dt); p.update(dt,{},Math.PI);
      assert.ok(p.onGround, `frame ${i} grounded`);
      assert.ok(Math.abs(p.pos.y-(deck.position.y+.5))<.002, `frame ${i} sole gap ${p.pos.y-deck.position.y-.5}`);
      assert.ok(Math.abs(p.pos.x-deck.position.x)<.002, `frame ${i} stays above same deck point`);
    }
  });
}
const flat={heightAbove:p=>p.y,groundAt:()=>0,rayDistance:()=>Infinity,rayHit:()=>null,pushCapsule:()=>null,groundNormal:()=>V(0,1,0)};
function locked() {
  const p=new Player(flat,{health:false,climb:false}); p.has=()=>false;
  p.pos.set(0,0,0);p.onGround=true;
  p.lockOn={dir:V(0,0,1),hop:V(0,0,1),at:V(0,0,8)};
  return p;
}
test('locked forward jump leaves a standing start toward the foe at its grounded movement pace',()=>{
  const p=locked(); p.update(1/60,{KeyW:true,Space:true},0);
  assert.ok(!p.onGround && p.vel.y>0);
  assert.ok(p.vel.z>=3,`forward takeoff ${p.vel.z}`);
  assert.ok(Math.abs(p.vel.x)<.001);
});
test('locked jump without direction remains vertical; side and back keep their dodge hops',()=>{
  const idle=locked();idle.update(1/60,{Space:true},0);
  assert.ok(Math.hypot(idle.vel.x,idle.vel.z)<.001);
  for(const key of ['KeyA','KeyD','KeyS']) {
    const p=locked();p.update(1/60,{[key]:true,Space:true},0);
    assert.ok(p._hop,`${key} still uses dodge`);
  }
});

for (const shaped of [false,true]) test(`dynamic ${shaped?'shaped':'disc'} platform follows descending and ascending travel`,()=>{
  const d={pos:V(0,5,0),vel:V(),r:5,top:5,bottom:4};
  if(shaped)d.topAt=()=>d.top;
  const p=new Player(flat,{health:false,climb:false,dynamic:()=>[{solid:d}]});
  p.has=()=>false;p.pos.copy(d.pos);p.onGround=true;
  for(const vy of [3,-3])for(let i=0;i<60;i++) {
    d.vel.set(1,vy,0);d.pos.addScaledVector(d.vel,1/60);d.top=d.pos.y;d.bottom=d.top-1;
    p.update(1/60,{},0);
    assert.ok(p.onGround && Math.abs(p.pos.y-d.top)<.002,`frame ${i}, vy ${vy}, gap ${p.pos.y-d.top}`);
  }
});
test('jumping off a rising moving collider releases its carried motion',()=>{
  const {physics,deck,player:p}=platform();
  deck.position.y+=.05;physics.syncMovers(1/60);p.update(1/60,{},0);
  deck.position.y+=.05;physics.syncMovers(1/60);p.update(1/60,{Space:true},0);
  assert.ok(!p.onGround && p.pos.y>deck.position.y+.5);
  assert.equal(p._ridden.length(),0);
});

test('near-target camera blending does not turn a forward lock jump away from the enemy',()=>{
  const p=locked();p.lockOn.hop=V(.6,0,.8);p.lockOn.at=V(0,0,2);
  p.update(1/60,{KeyW:true,Space:true},Math.PI/2);
  assert.ok(p.vel.z>=3 && Math.abs(p.vel.x)<.001,`takeoff ${p.vel.toArray()}`);
});
