import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {projectOutward} from '../tools/tripo-cloth.js';
import {separateShirt} from '../tools/tripo-garment-geometry.js';

test('inner shirt backing closes the exposed waist and follows the torso rig',async()=>{
 const {makeInnerShirt}=await import('../tools/tripo-garment-geometry.js');
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute([0,1.01,.085,0,1.15,.08,0,1.26,.08],3));
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Array(12).fill(0),4));
 geometry.setAttribute('skinWeight',new T.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
 const bone=new T.Bone(),root=new T.Group();root.add(bone);root.updateMatrixWorld(true);
 const source=new T.SkinnedMesh(geometry,new T.MeshStandardMaterial());root.add(source);source.bind(new T.Skeleton([bone]));
 const backing=makeInnerShirt(source,[[220,205,170],[220,205,170],[220,205,170]]);root.add(backing);root.updateMatrixWorld(true);
 assert.equal(backing.material.transparent,false);assert.equal(backing.material.opacity,1);
 for(const x of [-.11,0,.11])for(const y of [1.01,1.09,1.2]){
  const ray=new T.Raycaster(new T.Vector3(x,y,.5),new T.Vector3(0,0,-1));
  assert.ok(ray.intersectObject(backing).length>0,`opaque coverage at ${x}, ${y}`);
 }
 const rest=new T.Vector3().fromBufferAttribute(backing.geometry.attributes.position,0);
 bone.position.x=.1;root.updateMatrixWorld(true);backing.skeleton.update();
 assert.ok(backing.applyBoneTransform(0,rest.clone()).distanceTo(rest.clone().add(new T.Vector3(.1,0,0)))<1e-6);
});

test('overlapping leg collisions keep the front panel on the front side',()=>{
 const p=new T.Vector3(0,.7,.01),front=new T.Vector3(0,0,1);
 const caps=[-.07,.07].map(x=>[new T.Vector3(x,1,0),new T.Vector3(x,.4,0)]);
 for(let iteration=0;iteration<3;iteration++)for(const [a,b]of caps)projectOutward(p,a,b,.13,front);
 assert.ok(p.z>.10);assert.equal(p.x,0);
 for(const [a]of caps)assert.ok(Math.hypot(p.x-a.x,p.z)>=.13-1e-6);
 const before=p.clone();for(const [a,b]of caps)projectOutward(p,a,b,.13,front);
 assert.ok(p.distanceTo(before)<1e-8,'contact is stable across repeated solves');
});

test('shirt separation clips crossing triangles to the attachment plane without deleting trousers',()=>{
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,2,0,1,0,0,-1,0,0, 2,0,0,3,0,0,2,1,0],3));
 g.setAttribute('uv',new T.Float32BufferAttribute(new Array(12).fill(0),2));
 g.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Array(24).fill(0),4));
 g.setAttribute('skinWeight',new T.Float32BufferAttribute(Array.from({length:24},(_,i)=>i%4===0?1:0),4));g.setIndex([0,1,2,3,4,5]);
 const result=separateShirt(g,[true,true,true,false,false,false],1);
 assert.equal(result.index.count,6);
 for(let i=0;i<3;i++)assert.ok(result.attributes.position.getY(result.index.getX(i))>=1);
 assert.deepEqual([3,4,5].map(i=>result.index.getX(i)),[3,4,5]);
 for(let i=0;i<result.attributes.position.count;i++){let weight=0;for(let k=0;k<4;k++)weight+=result.attributes.skinWeight.getComponent(i,k);assert.equal(weight,1);}
});

test('brown trouser shadows are not classified as coral cloth',async()=>{
 const {isShirtColor}=await import('../tools/tripo-garment-geometry.js');
 assert.equal(isShirtColor([80,60,40]),false);
 assert.equal(isShirtColor([220,198,156]),false);
 assert.equal(isShirtColor([165,85,60]),true);
 assert.equal(isShirtColor([60,30,20]),true);
});

test('connected trouser reconstruction has three openings and normalized weights',async()=>{
 const {makeUnderlayer,fitTrouserWeights}=await import('../tools/tripo-garment-geometry.js');
 const root=new T.Group(),bones=['pelvis','thigh_l','calf_l','thigh_r','calf_r'].map(name=>{const b=new T.Bone();b.name=name;root.add(b);return b;});
 bones[0].position.y=1;for(const [i,x,y]of [[1,.07,.95],[2,.07,.5],[3,-.07,.95],[4,-.07,.5]])bones[i].position.set(x,y,0);root.updateMatrixWorld(true);
 const positions=[],indices=[],weights=[],colors=[];
 for(const x of [-.07,.07])for(const y of [.64,.7,.78,.9])for(let i=0;i<24;i++){const theta=i/24*Math.PI*2;positions.push(x+Math.sin(theta)*.085,y,Math.cos(theta)*.085);indices.push(x>0?1:3,0,0,0);weights.push(1,0,0,0);colors.push([210,190,150]);}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
 const faces=[];for(let side=0;side<2;side++)for(let row=0;row<3;row++)for(let col=0;col<24;col++){const a=side*96+row*24+col,b=side*96+row*24+(col+1)%24,c=a+24,d=b+24;faces.push(a,b,c,b,d,c);}geometry.setIndex(faces);geometry.computeVertexNormals();
 const source=new T.SkinnedMesh(geometry,new T.MeshStandardMaterial());root.add(source);source.bind(new T.Skeleton(bones));
 const repaired=makeUnderlayer(source,colors);fitTrouserWeights(repaired);
 const edges=new Map(),idx=repaired.geometry.index,used=new Set(idx.array);
 for(let i=0;i<idx.count;i+=3)for(let k=0;k<3;k++){const a=idx.getX(i+k),b=idx.getX(i+(k+1)%3),key=[Math.min(a,b),Math.max(a,b)].join(':');edges.set(key,(edges.get(key)??0)+1);}
 assert.ok([...edges.values()].every(n=>n<=2),'no intersecting or duplicate surface patches');
 assert.equal(used.size-edges.size+idx.count/3,-1,'one connected pants surface with three openings');
 const boundary=new Map();for(const [key,n]of edges)if(n===1){const [a,b]=key.split(':').map(Number);(boundary.get(a)??boundary.set(a,[]).get(a)).push(b);(boundary.get(b)??boundary.set(b,[]).get(b)).push(a);}
 assert.ok([...boundary.values()].every(v=>v.length===2),'closed boundary loops');
 let loops=0;const seen=new Set();for(const start of boundary.keys())if(!seen.has(start)){loops++;const stack=[start];while(stack.length){const i=stack.pop();if(seen.has(i))continue;seen.add(i);stack.push(...boundary.get(i));}}
 assert.equal(loops,3,'only waist and the two leg openings');
 const p=repaired.geometry.attributes.position,w=repaired.geometry.attributes.skinWeight;
 for(let i=0;i<p.count;i++){assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));let sum=0;for(let k=0;k<4;k++)sum+=w.getComponent(i,k);assert.ok(Math.abs(sum-1)<1e-5,`vertex ${i}: ${sum}`);}
});
