import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Humanoid } from '../humanoid.js';

// Measured against the normalized mesh, not the donor's face proportions.
export const FATHER_FACE = { eyeY:1.682, eyeX:.032, mouthY:1.613, frontZ:.065 };
let cached;
export function loadFatherV1(base = '/') {
  return cached ??= new GLTFLoader().loadAsync(`${base}characters/father-v1/model.glb`).catch(e=>{cached=null;throw e;});
}

const smooth=(a,b,x)=>T.MathUtils.smoothstep(x,a,b);
const patch=(x,y,w,h)=>1-smooth(.5,1,Math.hypot(x/w,y/h));

/** Runtime face keys retain the generated skin/UVs, with stylized lip motion. */
export function addFatherFace(mesh) {
  const g=mesh.geometry=mesh.geometry.clone(),p=g.attributes.position;
  const blink=new Float32Array(p.count*3),open=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),front=smooth(.065,.10,z);
    const eye=patch(Math.abs(x)-FATHER_FACE.eyeX,y-FATHER_FACE.eyeY,.024,.017)*front;
    blink[i*3+1]=-(y-FATHER_FACE.eyeY)*.97*eye;
    // A local lower-lip/jaw patch, with a hard zero below the chin. The old
    // broad oval extended onto the throat/scarf despite leaving the nose still.
    const jaw=patch(x,y-(FATHER_FACE.mouthY-.007),.045,.023)*front
      *smooth(1.596,1.604,y)*(1-smooth(FATHER_FACE.mouthY-.003,FATHER_FACE.mouthY+.006,y));
    open[i*3+1]=-.008*jaw;open[i*3+2]=-.001*jaw;
  }
  g.morphAttributes.position=[blink,open].map((a,i)=>{const b=new T.Float32BufferAttribute(a,3);b.name=['blink','open'][i];return b;});
  g.morphTargetsRelative=true;mesh.updateMorphTargets();
}

export function createFatherV1(char,asset) {
  const template=asset.scene;
  template.userData.palmNormal=[0,0,1];
  // This forward-palm source has individually fitted digit chains. The generic
  // palms-down hyperextension correction would straighten its measured pose twice.
  template.userData.preserveFingerRest=true;
  const source=[];template.traverse(o=>{if(o.isSkinnedMesh)source.push(o);});
  if(source.length!==1)throw new Error('Father needs one rigged textured mesh');
  const humanoid=new Humanoid(template,char,'m');
  char.root.traverse(o=>{if(o.isMesh)o.visible=false;});
  const mesh=humanoid.body;
  mesh.visible=true;mesh.name='FatherV1';mesh.material=source[0].material.clone();
  mesh.material.roughness=1;mesh.material.metalness=0;
  mesh.userData.father=true;humanoid.ownOutfit=true;
  addFatherFace(mesh);
  return humanoid;
}

// Only the narrow neck transition needs a twist correction. Linear skinning
// blends two displaced positions and can fold the throat; interpolate the gaze
// rotation instead, preserving the distance from the fitted neck axis. Bake the
// correction back into mesh-local positions so every material uses the same pose.
export function applyFatherGaze(humanoid,yaw,pitch) {
  const mesh=humanoid.body,g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal;
  const bones=mesh.skeleton.bones,head=humanoid.b.Head;
  let c=mesh.userData.gazeCorrection;
  if(!c){
    const h=bones.indexOf(head),j=g.attributes.skinIndex,w=g.attributes.skinWeight,rows=[];
    for(let i=0;i<p.count;i++){
      let k=0;for(let s=0;s<4;s++)if(j.getComponent(i,s)===h)k+=w.getComponent(i,s);
      if(k>1e-6&&k<.999999)rows.push({i,k,p:new T.Vector3().fromBufferAttribute(p,i),n:new T.Vector3().fromBufferAttribute(n,i)});
    }
    const moving=new Set(rows.map(r=>r.i)),nodes=[],byPosition=new Map(),vertexNode=new Map();
    const node=(i)=>{
      if(vertexNode.has(i))return vertexNode.get(i);
      const v=new T.Vector3().fromBufferAttribute(p,i),key=v.toArray().map(x=>x.toFixed(6)).join(',');
      let id=byPosition.get(key);
      if(id===undefined){id=nodes.length;byPosition.set(key,id);nodes.push({i,p:v,posed:v.clone(),moving:moving.has(i)});}
      vertexNode.set(i,id);return id;
    };
    const edges=[],seen=new Set(),ix=g.index,opposite=new Map();
    for(let i=0;i<ix.count;i+=3)for(let a=0;a<3;a++){
      const u=ix.getX(i+a),v=ix.getX(i+(a+1)%3);if(!moving.has(u)&&!moving.has(v))continue;
      const x=node(u),y=node(v),key=[Math.min(x,y),Math.max(x,y)].join(',');
      if(x===y||seen.has(key))continue;seen.add(key);edges.push({x,y,length:nodes[x].p.distanceTo(nodes[y].p)});
    }
    // Opposite vertices across adjacent triangles resist accordion folds that
    // edge lengths alone allow, without adding a separate surface or seam.
    for(let i=0;i<ix.count;i+=3){
      const tri=[ix.getX(i),ix.getX(i+1),ix.getX(i+2)];
      if(!tri.some(v=>moving.has(v)))continue;
      for(let a=0;a<3;a++){
        const x=node(tri[a]),y=node(tri[(a+1)%3]),z=node(tri[(a+2)%3]),key=[Math.min(x,y),Math.max(x,y)].join(',');
        const other=opposite.get(key);
        if(other!==undefined&&other!==z&&(nodes[other].moving||nodes[z].moving))edges.push({x:other,y:z,length:nodes[other].p.distanceTo(nodes[z].p),bend:true});
        else opposite.set(key,z);
      }
    }
    for(const r of rows)r.node=node(r.i);
    c=mesh.userData.gazeCorrection={rows,nodes,edges};
  }
  for(const r of c.rows){p.setXYZ(r.i,...r.p);n.setXYZ(r.i,...r.n);}
  humanoid.char.root.updateMatrixWorld(true);mesh.skeleton.update();
  const baseHead=head.matrixWorld.clone(),pivot=mesh.worldToLocal(head.getWorldPosition(new T.Vector3()));
  const palette=()=>bones.map((_,i)=>new T.Matrix4().fromArray(mesh.skeleton.boneMatrices,i*16).premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix));
  let matrices=palette();
  const skinMatrix=(i)=>{
    const m=new T.Matrix4();m.elements.fill(0);
    const j=g.attributes.skinIndex,w=g.attributes.skinWeight;
    for(let s=0;s<4;s++){
      const weight=w.getComponent(i,s);if(!weight)continue;
      const b=matrices[j.getComponent(i,s)];
      for(let a=0;a<16;a++)m.elements[a]+=b.elements[a]*weight;
    }
    return m;
  };
  const base=c.rows.map(r=>{const m=skinMatrix(r.i);return {p:r.p.clone().applyMatrix4(m),n:r.n.clone().applyNormalMatrix(new T.Matrix3().getNormalMatrix(m))};});
  head.rotateY(yaw);head.rotateX(pitch);head.updateWorldMatrix(true,true);mesh.skeleton.update();
  matrices=palette();
  const delta=new T.Matrix4().copy(mesh.matrixWorld).invert().multiply(head.matrixWorld).multiply(baseHead.invert()).multiply(mesh.matrixWorld);
  const rotation=new T.Quaternion().setFromRotationMatrix(delta),identity=new T.Quaternion();
  for(const node of c.nodes)if(!node.moving)node.posed.copy(node.p).applyMatrix4(skinMatrix(node.i));
  const inverses=[],normals=[];
  for(let a=0;a<c.rows.length;a++){
    const r=c.rows[a],q=identity.clone().slerp(rotation,r.k),m=skinMatrix(r.i),inverse=m.clone().invert();
    c.nodes[r.node].posed.copy(base[a].p).sub(pivot).applyQuaternion(q).add(pivot);
    const normal=base[a].n.applyQuaternion(q).applyMatrix3(new T.Matrix3().getNormalMatrix(m).invert()).normalize();
    inverses.push(inverse);normals.push(normal);
  }
  // Preserve the neck's edge lengths while keeping skull and collar boundaries
  // pinned. Weld UV duplicates in the solver so the atlas cannot open seams.
  const d=new T.Vector3();
  for(let iteration=0;iteration<16;iteration++)for(const e of c.edges){
    const a=c.nodes[e.x],b=c.nodes[e.y],sum=Number(a.moving)+Number(b.moving);if(!sum)continue;
    d.copy(b.posed).sub(a.posed);const length=d.length();if(length<1e-9)continue;
    d.multiplyScalar((length-e.length)/length/sum*(e.bend?.05:.8));
    if(a.moving)a.posed.add(d);if(b.moving)b.posed.sub(d);
  }
  for(let a=0;a<c.rows.length;a++){
    const r=c.rows[a],position=c.nodes[r.node].posed.clone().applyMatrix4(inverses[a]);
    p.setXYZ(r.i,...position);n.setXYZ(r.i,...normals[a]);
  }
  p.needsUpdate=true;n.needsUpdate=true;
}

export function resetFatherGaze(mesh) {
  const c=mesh.userData.gazeCorrection;if(!c)return;
  const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
  for(const r of c.rows){p.setXYZ(r.i,...r.p);n.setXYZ(r.i,...r.n);}
  p.needsUpdate=true;n.needsUpdate=true;
}
