import { Vector3, Quaternion } from 'three';
import { seatTripoArms } from '../tools/tripo-walk.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { updateTripoHands } from '../tools/tripo-hands.js';
const element=()=>({classList:{add(){},remove(){},toggle(){}},style:{},dataset:{},addEventListener(){},appendChild(){},remove(){},querySelector:()=>null});
globalThis.document??={createElement:element,body:element(),getElementById:()=>null,querySelector:()=>null};
const {parseBody,makeBody}=await import('../src/makehuman/body.js');
const {personParams}=await import('../src/makehuman/shape.js');
const {Humanoid}=await import('../src/humanoid.js');
const {buildCharacter}=await import('../src/player.js');

test('preview hands animate after bind-pose reset without accumulating curl while paused',()=>{
 const b=readFileSync('public/anim/mh/body.bin');
 const donor=makeBody(parseBody(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)),personParams({kind:'m',years:26,build:'slim',world:'desert'}));
 const h=new Humanoid(donor,buildCharacter(),'m');
 h.body.skeleton.pose();
 for(const hand of h.hands.sides){assert.equal(hand.joints.length,12,'all finger phalanges animate without leaf bones');assert.equal(hand.thumb.length,3,'all thumb phalanges animate without leaf bones');}
 const joints=h.hands.sides.flatMap(s=>[...s.joints,...s.thumb]);
 const snapshot=()=>joints.map(j=>j.b.quaternion.clone());
 const bind=snapshot();updateTripoHands(h,1/60,'rest');
 assert.deepEqual(snapshot(),bind,'T-pose stays unchanged');
 updateTripoHands(h,1/60,'walk');const first=snapshot();
 assert.ok(first.some((q,i)=>q.angleTo(bind[i])>.02),'walking restores finger articulation');
 for(let i=0;i<30;i++)updateTripoHands(h,1/60,'walk');
 const moving=snapshot();
 assert.ok(moving.some((q,i)=>q.angleTo(first[i])>1e-4),'fingers continue moving');
 for(let i=0;i<30;i++)updateTripoHands(h,0,'walk');
 assert.deepEqual(snapshot(),moving,'pause does not accumulate curl');
 for(const s of h.hands.sides)for(const j of s.thumb)assert.ok(j.b.quaternion.angleTo(j.rest)<.7,'thumb stays within a gentle range');
});

test('seated hands reach the lap with palms down, including when the character turns',()=>{
 const b=readFileSync('public/anim/mh/body.bin');
 const donor=makeBody(parseBody(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)),personParams({kind:'m',years:26,build:'slim',world:'desert'}));
 const c=buildCharacter(),h=new Humanoid(donor,c,'m');
 c.root.rotation.y=.7;c.legs.forEach(l=>l.rotation.x=-Math.PI/2);h.update();seatTripoArms(h,'drive');
 const q=c.root.getWorldQuaternion(new Quaternion()),up=new Vector3(0,1,0).applyQuaternion(q),right=new Vector3(1,0,0).applyQuaternion(q);
 for(const [side,sign]of [['r',-1],['l',1]]){
  const hip=h.b['thigh_'+side].getWorldPosition(new Vector3()),knee=h.b['calf_'+side].getWorldPosition(new Vector3()),hand=h.b['hand_'+side];
  const target=hip.clone().lerp(knee,.45).addScaledVector(up,.115).addScaledVector(right,sign*.025);
  assert.ok(hand.getWorldPosition(new Vector3()).distanceTo(target)<.005,'wrist reaches the lap');
  const turn=hand.getWorldQuaternion(new Quaternion()).multiply(h.rest.get(hand).q.clone().invert());
  assert.ok(h.handFrames[side].normal.clone().applyQuaternion(turn).dot(up)<-.95,'palm faces the thigh');
 }
});
