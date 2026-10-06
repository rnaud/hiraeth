import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Vector3,MathUtils} from 'three';
import {relaxWalkArms} from '../tools/tripo-walk.js';
function rig(){const root=new Group(),torso=new Group();root.add(torso);root.rotation.y=.6;torso.rotation.y=.12;const arms=[],elbows=[];for(const side of [-1,1]){const a=new Group(),e=new Group();torso.add(a);a.add(e);e.position.y=-.3;a.rotation.set(.3,0,side*.3);arms.push(a);elbows.push(e);}root.updateMatrixWorld(true);return {root,arms,elbows};}
const dir=(a,b)=>b.getWorldPosition(new Vector3()).sub(a.getWorldPosition(new Vector3())).normalize();
test('walk correction brings both arms inward while preserving elbow bend and lengths',()=>{const c=rig();const wrists=c.elbows.map(e=>{const w=new Group();w.position.set(0,-.2,.1);e.add(w);return w;});c.root.updateMatrixWorld(true);const bend=c.arms.map((a,i)=>dir(a,c.elbows[i]).angleTo(dir(c.elbows[i],wrists[i])));const before=c.arms.map(a=>a.quaternion.clone());relaxWalkArms(c,'walk');for(let i=0;i<2;i++){assert.ok(c.arms[i].quaternion.angleTo(before[i])>MathUtils.degToRad(5));assert.ok(Math.abs(dir(c.arms[i],c.elbows[i]).angleTo(dir(c.elbows[i],wrists[i]))-bend[i])<1e-7);assert.equal(c.elbows[i].position.length(),.3);}});
test('other motions and disabled comparison retain exact clip pose',()=>{for(const [motion,enabled]of [['climbUp',true],['idle',true],['rest',true],['walk',false]]){const c=rig(),before=c.arms.map(a=>a.quaternion.toArray());assert.deepEqual(relaxWalkArms(c,motion,enabled),[]);assert.deepEqual(c.arms.map(a=>a.quaternion.toArray()),before);}});

test('jog correction narrows exaggerated clip spread while preserving elbow bend',()=>{
 const c=rig();c.root.rotation.set(0,0,0);c.arms.forEach((a,i)=>a.rotation.set(.4,0,(i?1:-1)*.85));c.root.updateMatrixWorld(true);
 const wrists=c.elbows.map(e=>{const w=new Group();w.position.set(0,-.15,.2);e.add(w);return w;});c.root.updateMatrixWorld(true);
 const bend=c.arms.map((a,i)=>dir(a,c.elbows[i]).angleTo(dir(c.elbows[i],wrists[i])));
 relaxWalkArms(c,'jog');
 for(let i=0;i<2;i++){
  const d=dir(c.arms[i],c.elbows[i]);assert.ok(Math.atan2(Math.abs(d.x),-d.y)<MathUtils.degToRad(20),'upper arm is close to the body');
  assert.ok(Math.abs(dir(c.arms[i],c.elbows[i]).angleTo(dir(c.elbows[i],wrists[i]))-bend[i])<1e-7,'elbow bend is preserved');
 }
});
