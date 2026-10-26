import test from 'node:test';
import assert from 'node:assert/strict';
import {readElderModelUrl} from '../scripts/model-audit/elder-input.mjs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import './register-gadgets.js';
import {elderGuardian} from '../src/temples/guardian-generated.js';
import {TempleRuntime} from '../src/temples/runtime.js';
import {ARZACH_TEMPLE} from '../src/temples/arzach.js';
import {beginHelperEncounter,helperRun,consumeHelperReturn} from '../src/temples/helper-encounter.js';
import {Physics} from '../src/physics.js';
import {GameState} from '../src/game-state.js';
import {allInteractables} from '../src/interact.js';
import {GUARDIAN_BY_ID} from '../src/arena-guardians.js';
globalThis.ProgressEvent ??= class { constructor(type, v) { this.type = type; Object.assign(this, v); } };
GLTFLoader.prototype.load = function (url, onLoad, onProgress, onError) {
  try {
    const bytes = readElderModelUrl(url), len = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + len));
    for (const m of json.meshes) for (const p of m.primitives) delete p.material;
    delete json.materials; delete json.textures; delete json.images;
    json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + len).toString('base64');
    this.parse(JSON.stringify(json), '', onLoad, onError);
  } catch (e) { onError?.(e); }
};

const V=(...a)=>new THREE.Vector3(...a),DT=1/60;
test('Elder asset failure keeps the fallback; a stalled request never blocks temple construction',async()=>{
 const failed=elderGuardian({load:async()=>{throw new Error('offline');}});
 assert.equal(await failed.ready,false);assert.ok(!failed.generated);failed.dispose();
 const stalled=elderGuardian({load:()=>new Promise(()=>{})});assert.ok(stalled.group);assert.equal(stalled.radius,3);stalled.dispose();
});
test('approved Elder inhabits the actual elevated Aerie, invites a helping flight and returns to the perch after success',async()=>{
 const scene=new THREE.Scene(),game=new GameState(null),level={ground:{baseAt:()=>0,heightAt:()=>0},lights:[]};
 const rt=new TempleRuntime({scene,level,def:ARZACH_TEMPLE,game}),g=rt.guardian,m=g.model;
 const physics=new Physics(scene,level.ground);rt.init(physics);
 const P={pos:g.arena.center.clone(),heading:0,vel:V(),dead:false,onGround:false,gliding:false};rt.connect({player:P});
 assert.equal(await m.ready,true);assert.ok(m.generated&&m.group.parent===rt.root);assert.ok(m.inner.meshes[0].material.isShaderMaterial);
 assert.equal(m.inner.meshes[0].skeleton.bones.length,23);assert.ok(m.home.y>1000);
 assert.equal(m.inner.meshes[0].material.uniforms.uShade.value.z,.12,'authored feather ink is not buried under dense procedural cross-hatching');
 const frames=s=>{for(let i=0;i<s/DT;i++)g.update(DT,(g._t=(g._t??0)+DT));};
 g.wake();frames(4);assert.equal(g.state,'sleep');assert.equal(g.def.helper,'elderflight');
 const marks=g.marks.lines;assert.ok(marks.every(l=>l.parent===m.tellRig));
 assert.equal(m.floats,false,'the peaceful Elder stays grounded until her helping flight');assert.ok(m.inner.bones.leg0_foot.getWorldPosition(V()).toArray().every(Number.isFinite));
 P.pos.copy(m.pos).add(V(0,4.4,0));P.gliding=true;frames(1);
 assert.equal(g.meter,0,'gliding beside the model cannot substitute for the completed flight');P.gliding=false;
 let href=null;rt.startHelper=()=>{href=beginHelperEncounter(game,'arzach',{from:'arzach',returnPose:{pos:P.pos.toArray(),up:[0,1,0],fwd:[0,0,1]}});return !!href;};
 const invite=allInteractables().find(e=>e.id==='temple.arzach.help');assert.ok(invite?.enabled());
 const away=m.mouth.clone().sub(m.pos).setY(0).normalize(),near=m.pos.clone().addScaledVector(away,m.radius+.5);near.y=g.arena.y;
 assert.ok(near.clone().sub(m.pos).setY(0).length()>m.radius,'invitation reachable outside body collision');
 assert.ok(invite.distance({pos:near})<invite.range);assert.equal(invite.distance({pos:near.clone().add(V(0,-20,0))}),Infinity,'not offered through another floor');
 P.pos.copy(near);invite.use();
 const run=helperRun(game,'elderflight',new URLSearchParams(href).get('encounter'));
 assert.equal(run.onResult({failed:true,goal:{game:'elderflight',complete:false}}),false);
 assert.equal(game.flag('temple.arzach.done'),undefined);
 assert.equal(run.onResult({failed:false,goal:{game:'elderflight',complete:true}}),true);run.left();
 assert.equal(consumeHelperReturn(game,'arzach','arzach',{restore:p=>P.pos.fromArray(p.pos),resolve:()=>g.resolve()}).success,true);
 assert.equal(g.state,'resolved');assert.equal(game.flag('temple.arzach.done'),true);
 const perched=rt.change.perched;assert.equal(await perched.ready,true);rt.change.set(true,{instant:true});rt.change.update(DT,30);
 assert.ok(perched.generated&&perched.group.parent===rt.change.root);assert.ok(perched.mouth.toArray().every(Number.isFinite));
 let disposed=false;perched.inner.meshes[0].material.addEventListener('dispose',()=>disposed=true);rt.dispose();assert.ok(disposed);
});
test('Arena calls the same new Elder',async()=>{
 const m=GUARDIAN_BY_ID.arzach.model();new THREE.Group().add(m.group);assert.equal(await m.ready,true);assert.equal(m.inner.meshes[0].skeleton.bones.length,23);m.dispose();
});
