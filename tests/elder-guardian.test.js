import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import './register-gadgets.js';
import {elderGuardian} from '../src/temples/guardian-generated.js';
import {TempleRuntime} from '../src/temples/runtime.js';
import {ARZACH_TEMPLE,ROOST} from '../src/temples/arzach.js';
import {Physics} from '../src/physics.js';
import {GameState} from '../src/game-state.js';
import {allInteractables} from '../src/interact.js';
import {GUARDIAN_BY_ID} from '../src/arena-guardians.js';
globalThis.ProgressEvent ??= class { constructor(type, v) { this.type = type; Object.assign(this, v); } };
const PUBLIC = new URL('../public/', import.meta.url);
GLTFLoader.prototype.load = function (url, onLoad, onProgress, onError) {
  try {
    const bytes = fs.readFileSync(new URL(String(url).replace(/^\/+/, ''), PUBLIC)), len = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + len));
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
test('approved Elder replaces the actual elevated Aerie, calms with flight, resolves by touch and returns to the perch',async()=>{
 const scene=new THREE.Scene(),game=new GameState(null),level={ground:{baseAt:()=>0,heightAt:()=>0},lights:[]};
 const rt=new TempleRuntime({scene,level,def:ARZACH_TEMPLE,game}),g=rt.guardian,m=g.model;
 const physics=new Physics(scene,level.ground);rt.init(physics);
 const P={pos:g.arena.center.clone(),heading:0,vel:V(),dead:false,onGround:false,gliding:false};rt.connect({player:P});
 assert.equal(await m.ready,true);assert.ok(m.generated&&m.group.parent===rt.root);assert.ok(m.inner.meshes[0].material.isShaderMaterial);
 assert.equal(m.inner.meshes[0].skeleton.bones.length,23);assert.ok(m.home.y>1000);
 assert.equal(m.inner.meshes[0].material.uniforms.uShade.value.z,.12,'authored feather ink is not buried under dense procedural cross-hatching');
 const frames=s=>{for(let i=0;i<s/DT;i++)g.update(DT,(g._t=(g._t??0)+DT));};
 g.wake();frames(4);assert.ok(['fight','open'].includes(g.state));
 const marks=g.marks.lines;assert.ok(marks.every(l=>l.parent===m.tellRig));
 g.stop();g.meter=g.floor=.46;g.enter('open');g.openFor=20;frames(2);
 assert.ok(m.floats);assert.ok(m.inner.bones.leg0_foot.getWorldPosition(V()).y>g.arena.y+2);
 P.pos.copy(m.pos).add(V(0,4.4,0));P.gliding=true;const before=g.meter;frames(1);
 assert.ok(g.meter>before,'flying alongside the actual generated Elder still calms her');P.gliding=false;
 g.stop();g.meter=g.floor=.8;g.enter('weary');frames(18);
 const touch=allInteractables().find(e=>e.id==='temple.arzach.touch');assert.ok(touch?.enabled());
 const near=m.mouth.clone(),away=near.clone().sub(m.pos).setY(0).normalize();near.addScaledVector(away,2);near.y=g.arena.y;
 assert.ok(near.clone().sub(m.pos).setY(0).length()>m.radius,'touch from outside body collision');
 assert.ok(touch.distance({pos:near})<touch.range);assert.ok(m.mouth.y-g.arena.y<4,'lowered head is reachable');
 touch.use();assert.equal(g.state,'resolved');assert.equal(game.flag('temple.arzach.done'),true);
 const perched=rt.change.perched;assert.equal(await perched.ready,true);rt.change.set(true,{instant:true});rt.change.update(DT,30);
 assert.ok(perched.generated&&perched.group.parent===rt.change.root);assert.ok(perched.mouth.toArray().every(Number.isFinite));
 let disposed=false;perched.inner.meshes[0].material.addEventListener('dispose',()=>disposed=true);rt.dispose();assert.ok(disposed);
});
test('Arena calls the same new Elder',async()=>{
 const m=GUARDIAN_BY_ID.arzach.model();new THREE.Group().add(m.group);assert.equal(await m.ready,true);assert.equal(m.inner.meshes[0].skeleton.bones.length,23);m.dispose();
});
