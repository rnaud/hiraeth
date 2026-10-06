import * as THREE from 'three';

// Fit the MakeHuman rest joints to this generated T-pose before transferring
// weights. Bone names, hierarchy and coordinate frames are preserved.
export function fitDonorToSurface(donor, surface) {
  const body = donor.getObjectByName('Body');
  const bones = body.skeleton.bones;
  donor.updateMatrixWorld(true);
  const original = bones.map(b => b.getWorldPosition(new THREE.Vector3()));
  const byName = Object.fromEntries(bones.map((b, i) => [b.name, i]));
  const height = Math.max(...surface.map(p => p.y));
  const median = values => {
    values.sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  };
  const armCenter = x => {
    const slice = surface.filter(p => Math.abs(p.x - x) < .018 && p.y > height * .64 && p.y < height * .84);
    if (slice.length < 8) throw new Error(`Insufficient arm surface at x=${x}`);
    return new THREE.Vector3(x, median(slice.map(p => p.y)), median(slice.map(p => p.z)));
  };
  // The generated boots conceal the ankle; use a proportional initial estimate,
  // explicitly reported for review. Shoulder/elbow/wrist centers come from slices.
  const sourceY = [0, original[byName.foot_l].y, original[byName.calf_l].y, original[byName.pelvis].y,
    original[byName.upperarm_l].y, original[byName.neck_01].y, original[byName.Head].y, height];
  const targetY = [0, height * .085, height * .275, height * .53,
    armCenter(original[byName.upperarm_l].x).y, height * .835, height * .91, height];
  function warpY(y) {
    for (let i = 1; i < sourceY.length; i++) {
      if (y <= sourceY[i]) return THREE.MathUtils.lerp(targetY[i-1], targetY[i],
        (y-sourceY[i-1]) / Math.max(sourceY[i]-sourceY[i-1], 1e-6));
    }
    return y;
  }
  const target = original.map(p => new THREE.Vector3(p.x, warpY(p.y), p.z));
  for (const side of ['l', 'r']) {
    for (const name of ['upperarm', 'lowerarm', 'hand']) {
      const i = byName[`${name}_${side}`];
      target[i] = armCenter(original[i].x);
    }
    const hand = byName[`hand_${side}`], shift = target[hand].clone().sub(original[hand]);
    const descend = b => { for (const child of b.children) if (child.isBone) {
      const i = byName[child.name]; target[i] = original[i].clone().add(shift); descend(child);
    }};
    descend(bones[hand]);
  }
  // The generated flat hands have shorter palms and straighter fingers than
  // the donor. Translation alone leaves distal joints beyond the fingertips.
  // Fit digit chains before deforming the donor and transferring surface weights.
  const fingerFit=[];
  for(const side of ['l','r']){
    const sign=side==='l'?1:-1,wrist=target[byName['hand_'+side]];
    const handPoints=surface.filter(p=>p.x*sign>wrist.x*sign+.02&&Math.abs(p.y-wrist.y)<.07);
    if(handPoints.length<200)continue; // Sparse fixtures / unsuitable pose: no guessed digit fit.
    for(const finger of ['index','middle','ring','pinky']){
      const ids=[1,2,3].map(n=>byName[`${finger}_0${n}_${side}`]);if(ids.some(i=>i===undefined))continue;
      const base=target[ids[0]],guideZ=wrist.z+(base.z-wrist.z)*1.35-.005-(finger==='pinky'?.009:0);
      const baseX=wrist.x+(base.x-wrist.x)*.68;
      const samples=handPoints.filter(p=>p.x*sign>baseX*sign+.02&&Math.abs(p.z-guideZ)<(finger==='pinky'?.008:.017));
      if(samples.length<12)continue;
      samples.sort((a,b)=>a.x*sign-b.x*sign);
      const tipX=samples[Math.floor(samples.length*.98)].x;
      const nearTip=samples.filter(p=>p.x*sign>tipX*sign-.018),tipZ=median(nearTip.map(p=>p.z));
      for(let j=0;j<3;j++){
        const t=[0,.46,.78][j],x=THREE.MathUtils.lerp(baseX,tipX,t),z=THREE.MathUtils.lerp(guideZ,tipZ,t);
        const slice=handPoints.filter(p=>Math.abs(p.x-x)<.009&&Math.abs(p.z-z)<.014);
        target[ids[j]]=new THREE.Vector3(x,slice.length?median(slice.map(p=>p.y)):wrist.y,z);
      }
      fingerFit.push({side,finger,tipX,joints:ids.map(i=>target[i].toArray())});
    }
    const thumbIds=[1,2,3].map(n=>byName[`thumb_0${n}_${side}`]);
    if(thumbIds.every(i=>i!==undefined)){
      const samples=handPoints.filter(p=>p.z>wrist.z+.038&&p.x*sign<wrist.x*sign+.10);
      if(samples.length>12){
        samples.sort((a,b)=>a.z-b.z);const endZ=samples[Math.floor(samples.length*.97)].z;
        const tip=samples.filter(p=>p.z>endZ-.009),tipX=median(tip.map(p=>p.x)),tipY=median(tip.map(p=>p.y));
        const base=target[thumbIds[0]].clone();base.x=wrist.x+(base.x-wrist.x)*.75;base.y=wrist.y-.008;
        const end=new THREE.Vector3(tipX,tipY,endZ);
        thumbIds.forEach((i,j)=>{target[i]=base.clone().lerp(end,[0,.5,.8][j]);});
        fingerFit.push({side,finger:'thumb',joints:thumbIds.map(i=>target[i].toArray())});
      }
    }
  }
  const shifts = target.map((p,i) => p.clone().sub(original[i]));
  donor.traverse(mesh => {
    if (!mesh.isSkinnedMesh) return;
    mesh.geometry = mesh.geometry.clone();
    const p=mesh.geometry.attributes.position, j=mesh.geometry.attributes.skinIndex, w=mesh.geometry.attributes.skinWeight;
    for (let i=0;i<p.count;i++) {
      const delta=new THREE.Vector3();
      for (let k=0;k<4;k++) delta.addScaledVector(shifts[j.getComponent(i,k)],w.getComponent(i,k));
      p.setXYZ(i,p.getX(i)+delta.x,p.getY(i)+delta.y,p.getZ(i)+delta.z);
    }
    p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();
  });
  // Traverse in hierarchy order: parent's world matrix must already reflect its fit.
  for (let i=0;i<bones.length;i++) {
    const b=bones[i];
    b.position.copy(b.parent.worldToLocal(target[i].clone()));
    b.updateMatrixWorld(true);
  }
  donor.updateMatrixWorld(true);
  body.skeleton.calculateInverses();
  donor.traverse(mesh => { if(mesh.isSkinnedMesh) mesh.bind(body.skeleton,mesh.matrixWorld); });
  return {
    method:'surface-section arms and guided digit chains; proportional torso and concealed ankle estimates',
    fingerFit,
    joints: bones.map((b,i)=>({name:b.name,original:original[i].toArray(),fitted:target[i].toArray()})),
  };
}
