import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { registerTarget } from './targets.js';
import { slotStorage } from './save-slots.js';

const UP = new THREE.Vector3(0,1,0);
const FLUID_DEFAULT=['#52c8cf','#966ede'];   // the fluid's first tones (fluid-tool.js), if a hit brings none
const FLUID_BLOOM=9;                        // s a fluid-woken node keeps the fluid's colours
const _tone=new THREE.Color();
export const WORLD_REACTIONS = {
  desert: {kind:'flower',quiet:'#a4a77d',awake:'#71d7cf',radius:9,spores:true},
  incal: {kind:'screen',quiet:'#435861',awake:'#ffc98b',radius:12},
  arzach: {kind:'fan',quiet:'#d9cbb0',awake:'#cfa5d5',radius:11},
  garage: {kind:'machine',quiet:'#70858c',awake:'#efc770',radius:10},
  edena: {kind:'flower',quiet:'#8bb7a1',awake:'#f2aecc',radius:11},
  perdide: {kind:'fungus',quiet:'#827699',awake:'#94ebd3',radius:10,spores:true,shy:true},
  bazaar: {kind:'screen',quiet:'#46616a',awake:'#f6dcb0',radius:13},
  arzach2: {kind:'fan',quiet:'#e6dccb',awake:'#e8a68e',radius:11},
  buried: {kind:'fan',quiet:'#8c9c98',awake:'#f3a57c',radius:10},
  spheres: {kind:'flower',quiet:'#a8c48a',awake:'#f6e2a0',radius:11},
  perdide2: {kind:'fungus',quiet:'#6f6a94',awake:'#ffb38a',radius:10,spores:true,shy:true},
  lab: {kind:'flower',quiet:'#b9b5ad',awake:'#71d7cf',radius:9},
  atelier: {kind:'fan',quiet:'#c4beb0',awake:'#8cbdb7',radius:10},
  home: {kind:'flower',quiet:'#d9a37f',awake:'#5fd0c6',radius:9},
};

/** Stateful reactions, independent of rendering. A direct encounter sends one
 * delayed wave through its cluster. Echoes cannot trigger more echoes. */
export class ReactionField {
  constructor(nodes,{seen=[],onEncounter=()=>{}}={}) {
    this.nodes=nodes.map(n=>({...n,energy:0,inside:false,cooldown:0,pulseAt:Infinity,pulse:0,remembered:seen.includes(n.cluster)}));
    this.seen=new Set(seen);this.onEncounter=onEncounter;this.time=0;
  }
  /** A direct encounter: the node wakes, the cluster is remembered and a delayed echo runs through it. */
  encounter(n) {
    n.cooldown=7;n.pulse=1;
    const known=this.seen.has(n.cluster);this.seen.add(n.cluster);
    this.onEncounter(n,known);
    this.nodes.filter(o=>o.cluster===n.cluster&&o!==n).forEach(o=>{o.pulseAt=Math.min(o.pulseAt,this.time+.45+n.pos.distanceTo(o.pos)/12);});
  }
  /** Touched from afar (a glob of the traveller's fluid): the same encounter as walking up to it.
   * While it is still awake from the last one it just pulses again; a weaker touch (the push) only shimmers. */
  trigger(n,strength=1) {
    if(strength>=1&&n.cooldown===0)this.encounter(n);
    else n.pulse=Math.max(n.pulse,Math.min(1,strength));
    return true;
  }
  update(dt,player,eye,forward,visible=()=>true) {
    this.time+=dt;
    for(const n of this.nodes){
      n.cooldown=Math.max(0,n.cooldown-dt);
      const distance=n.pos.distanceTo(player),to=n.pos.clone().sub(eye),lookDistance=to.length();
      const gaze=lookDistance>0 && lookDistance<(n.gazeRadius??24) && to.multiplyScalar(1/lookDistance).dot(forward)>.94;
      const sensed=distance<n.radius || gaze;
      const inside=sensed && visible(n);
      if(inside&&!n.inside&&n.cooldown===0)this.encounter(n);
      // Hysteresis prevents jitter at the approach boundary retriggering it.
      n.inside=inside || (n.inside && distance<n.radius*1.35);
      if(this.time>=n.pulseAt){n.pulse=1;n.pulseAt=Infinity;}
      n.pulse=Math.max(0,n.pulse-dt*.22);
      const target=Math.max(inside?1:0,n.pulse);
      n.energy+=(target-n.energy)*(1-Math.exp(-dt*(target>n.energy?2.5:.65)));
    }
  }
}

const FONT={
 A:['010','101','111','101','101'],G:['111','100','101','101','111'],I:['111','010','010','010','111'],N:['101','111','111','111','101'],
 W:['101','101','111','111','010'],E:['111','100','110','100','111'],S:['111','100','111','001','111'],Y:['101','101','010','010','010'],O:['111','101','101','101','111'],U:['101','101','101','101','111'],
 H:['101','101','111','101','101'],R:['110','101','110','101','101'],D:['110','101','101','101','110'],T:['111','010','010','010','010'],B:['110','101','110','101','110'],C:['111','100','100','100','111'],K:['101','101','110','101','101'],
};
function letters(text,width,material){
  const geo=[],step=width/(text.length*4),x0=-width/2;
  [...text].forEach((c,i)=>(FONT[c]??[]).forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='1')geo.push(new THREE.BoxGeometry(step*.8,step*.8,.035).translate(x0+(i*4+x)*step,(2-y)*step,0));})));
  return new THREE.Mesh(mergeGeometries(geo),material);
}
function reactiveMaterial(color){
  const base=makeMaterial({color,flat:true,side:THREE.DoubleSide});
  const m=base.clone();m.uniforms={...base.uniforms,uColor:{value:new THREE.Color(color)},uGlow:{value:0}};return m;
}
function objectFor(theme,screen=false){
  const root=new THREE.Group();root.userData.noCollide=true;
  const m=reactiveMaterial(theme.quiet),metal=makeMaterial({color:'#617371',flat:true}),ink=makeMaterial({color:'#34494d',flat:true});
  const moving=new THREE.Group();root.add(moving);
  let texts=[],petals=null;
  if(screen||theme.kind==='screen'||theme.kind==='machine'){
    const pedestal=new THREE.Mesh(new THREE.BoxGeometry(.55,1.8,.5),metal);pedestal.position.y=.9;root.add(pedestal);
    const frame=new THREE.Mesh(new THREE.BoxGeometry(3.7,2.2,.36),ink);frame.position.y=2.7;moving.add(frame);
    const face=new THREE.Mesh(new THREE.BoxGeometry(3.4,1.9,.08),m);face.position.set(0,2.7,.22);moving.add(face);
    const textMat=makeMaterial({color:'#304c53',flat:true,glow:.6});
    texts=['WE SEE YOU','AGAIN','HEARD'].map(word=>{const mesh=letters(word,2.9,textMat);mesh.position.set(0,2.65,.3);mesh.visible=false;moving.add(mesh);return mesh;});
    // Three apertures recur on flowers, machines and screens across worlds.
    for(let i=-1;i<=1;i++) {const dot=new THREE.Mesh(new THREE.SphereGeometry(.1,7,5),m);dot.position.set(i*.4,1.99,.3);moving.add(dot);}
  } else {
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(-.14,.45,.04),new THREE.Vector3(.08,.85,0),new THREE.Vector3(0,1.2,0)]);
    root.add(new THREE.Mesh(new THREE.TubeGeometry(curve,8,.065,5,false),metal));
    for(const side of [-1,1]){const leaf=new THREE.Mesh(new THREE.SphereGeometry(1,8,5).scale(.3,.045,.12).rotateZ(side*.5),metal);leaf.position.set(side*.2,.48+side*.1,0);root.add(leaf);}
    const core=new THREE.Mesh(new THREE.SphereGeometry(.25,10,7),m);core.position.y=1.3;moving.add(core);
    petals=new THREE.Group();petals.position.y=1.2;moving.add(petals);
    const parts=[];
    for(let i=0;i<7;i++){
      const a=i*Math.PI*2/7;
      const g=theme.kind==='fungus'?new THREE.SphereGeometry(1,8,6).scale(.38,.18,.5):new THREE.SphereGeometry(1,8,6).scale(.22,.08,.65);
      g.rotateX(theme.kind==='fan'?-.6:-.15).translate(0,.12,.48).rotateY(a);parts.push(g);
    }
    petals.add(new THREE.Mesh(mergeGeometries(parts),m));
    for(let i=-1;i<=1;i++){const seed=new THREE.Mesh(new THREE.SphereGeometry(.085,6,4),m);seed.position.set(i*.16,1.56,0);moving.add(seed);}
  }
  for(const group of [root,moving]){
    const batches=new Map();
    for(const child of [...group.children])if(child.isMesh&&!texts.includes(child)){
      child.updateMatrix();const g=child.geometry.clone().applyMatrix4(child.matrix);g.deleteAttribute('uv');
      if(!batches.has(child.material))batches.set(child.material,[]);batches.get(child.material).push(g);group.remove(child);child.geometry.dispose();
    }
    for(const [material,parts] of batches){group.add(new THREE.Mesh(mergeGeometries(parts),material));parts.forEach(g=>g.dispose());}
  }
  return {root,m,moving,petals,texts,base:new THREE.Color(theme.quiet),active:new THREE.Color(theme.awake),lastEnergy:0};
}

export class ReactiveWorld {
  constructor(scene,level,physics,content,{storage=slotStorage}={}){
    this.theme=WORLD_REACTIONS[level.id];this.storage=storage;this.level=level;this.physics=physics;
    this.root=new THREE.Group();this.root.name='Responsive world';this.root.userData.noCollide=true;scene.add(this.root);
    this.key='moebius.encounters.v1';let saved={};try{saved=JSON.parse(storage?.getItem(this.key)??'{}');}catch{}
    this.saved=saved;this.nodes=[];this.particles=[];this.tick=.21;this.dirty=false;this.saveTimer=0;
    const seeds=[{pos:level.spawn.clone(),up:UP}];
    for(const npc of content.npcs??[])seeds.push({pos:new THREE.Vector3(npc.at[0],npc.y??level.spawn.y,npc.at[1]),up:UP});
    for(let i=1;i<=5;i++)seeds.push({pos:level.spawn.clone().add(new THREE.Vector3(i%2?12:-12,0,-i*30)),up:UP});
    if(level.id==='bazaar')for(let i=0;i<8;i++)seeds.push({pos:new THREE.Vector3(i%2?18:-18,0,80-i*53),up:UP});
    // Portal endpoints provide a local frame even on the Hangar's ceiling/ring.
    for(const p of level.navigationPortals??[])seeds.push({pos:p.to.clone(),up:p.toUp.clone()});
    const goal=content.story.goal;
    if(typeof goal[1]==='number')seeds.push({pos:new THREE.Vector3(...goal),up:level.gravityAt?.(new THREE.Vector3(...goal))??UP});
    else if(Number.isFinite(level.ground.heightAt(goal[0],goal[2])))seeds.push({pos:new THREE.Vector3(goal[0],level.ground.heightAt(goal[0],goal[2]),goal[2]),up:UP});
    for(const s of content.relics.spots){const a=Array.isArray(s)?s:s.at;const x=a[0],z=a.length===2?a[1]:a[2];const y=a.length===2?level.ground.heightAt(x,z):a[1];if(Number.isFinite(y))seeds.push({pos:new THREE.Vector3(x,y,z),up:level.gravityAt?.(new THREE.Vector3(x,y,z))??UP});}
    if(level.id==='bazaar'){
      seeds.length=0;
      for(let i=0;i<8;i++)seeds.push({pos:new THREE.Vector3(i%2?23:-23,0,95-i*54),up:UP});
    }
    seeds.slice(0,28).forEach((seed,i)=>{
      const up=seed.up,rotation=new THREE.Quaternion().setFromUnitVectors(UP,up);
      for(let j=0;j<3;j++){
        const local=(level.id==='bazaar'?new THREE.Vector3(Math.sin(j+i)*.6,0,-j*5):new THREE.Vector3((j-1)*3+5+Math.sin(i*7+j)*.9,0,-4-j*3+Math.cos(i+j*3)*.8)).applyQuaternion(rotation);
        const proposed=seed.pos.clone().add(local);
        const hit=physics.rayHit(proposed.clone().addScaledVector(up,10),up.clone().negate(),35);
        let pos=hit?.point;
        if(up.y>.99){const ground=level.ground.heightAt(proposed.x,proposed.z);if(Number.isFinite(ground)&&(!pos||ground>pos.y))pos=new THREE.Vector3(proposed.x,ground,proposed.z);}
        if(!pos||level.unsafe?.(pos))continue;
        this.addNode(pos,up,`${level.id}:${i}`,rotation,j);
      }
    });
    // Existing illustrated signs in the market also wake; they keep their art.
    for(const [i,sign] of (level.reactiveScreens??[]).entries()){
      if(i%4!==0||sign.h<4)continue;
      const obj=objectFor(this.theme,true);obj.root.position.copy(sign.pos);obj.root.rotation.y=sign.yaw;
      obj.root.scale.setScalar(Math.min(sign.w/4,2.5));obj.root.position.y-=2.7*obj.root.scale.x;
      this.root.add(obj.root);this.nodes.push({pos:sign.pos.clone(),radius:16,gazeRadius:70,cluster:`${level.id}:signs:${Math.floor(i/16)}`,obj,up:UP});
    }
    this.field=new ReactionField(this.nodes,{seen:saved.seen??[],onEncounter:(n,known)=>{
      n.obj.returning=known;n.obj.heardElsewhere=!known&&(saved.worlds??[]).some(w=>w!==level.id);
      this.dirty=true;

    }});
    // A glob of magical fluid wakes a node from afar and it blooms in the fluid's own tones for a while;
    // the push only stirs it (a shimmer and a sway).
    const screenLike=this.theme.kind==='screen'||this.theme.kind==='machine';
    this.offTargets=this.field.nodes.map(n=>registerTarget({kind:'reactive',radius:n.obj.root.scale.x*(screenLike||n.radius>=16?1.9:.75),
      position:()=>n.pos,enabled:()=>n.obj.root.visible,onHit:(mode,point,dir,info)=>{
        if(mode==='shoot')n.fluid={tones:(info?.colours??FLUID_DEFAULT).map(c=>new THREE.Color(c)),t:0};
        else if(mode==='push')n.sway=1;
        return this.field.trigger(n,mode==='shoot'?1:.45);
      }}));
    const pm=makeMaterial({color:this.theme.awake,flat:true,glow:.75});
    this.spores=new THREE.InstancedMesh(new THREE.SphereGeometry(.055,5,4),pm,72);
    this.spores.userData.noCollide=true;this.spores.frustumCulled=false;this.spores.count=0;this.root.add(this.spores);
    this.matrix=new THREE.Matrix4();this.quaternion=new THREE.Quaternion();this.scale=new THREE.Vector3();this.forward=new THREE.Vector3();
  }
  addNode(pos,up,cluster,rotation,index){
    const obj=objectFor(this.theme);
    if(this.theme.kind==='screen')obj.root.scale.setScalar(.7);
    if(this.level.id==='edena')obj.root.scale.setScalar(1.4);
    if(this.level.id==='arzach')obj.root.scale.set(1.05,1.7,1.05);
    if(this.level.id==='perdide')obj.root.scale.set(1.3,.8,1.3);
    if(this.level.id==='home')obj.root.scale.setScalar(.45);   // small flowers in the yard at home
    if(this.theme.kind!=='screen'&&this.theme.kind!=='machine')obj.root.scale.multiplyScalar(.8+.25*(1+Math.sin(pos.x*.7+pos.z)));
    obj.root.position.copy(pos);obj.root.quaternion.copy(rotation);
    obj.root.rotateY(index*.65);this.root.add(obj.root);
    this.nodes.push({pos:pos.clone().addScaledVector(up,1.3),radius:this.theme.radius,cluster,obj,up:up.clone(),rotation:rotation.clone()});
  }
  emit(n){for(let i=0;i<8&&this.particles.length<72;i++)this.particles.push({pos:n.pos.clone(),vel:new THREE.Vector3(Math.sin(i*2.4)*.32,.4+i*.035,Math.cos(i*2.4)*.32).applyQuaternion(n.rotation??new THREE.Quaternion()),life:3.2});}
  dispose(){this.offTargets.forEach(off=>off());this.offTargets=[];this.root.removeFromParent();}
  clear(){
    this.dirty=false;this.saved={};this.field.seen.clear();
    try{this.storage?.removeItem(this.key);}catch{}
  }
  flush(){
    if(!this.dirty)return;
    const worlds=[...new Set([...(this.saved.worlds??[]),this.level.id])];
    this.saved={seen:[...this.field.seen],worlds};
    try{this.storage?.setItem(this.key,JSON.stringify(this.saved));}catch{}
    this.dirty=false;
  }
  update(dt,t,player,camera,paused=false){
    if(paused)return;
    this.tick+=dt;this.saveTimer+=dt;
    camera.getWorldDirection(this.forward);
    // Occlusion is cached per node; remote clusters need no raycasts.
    if(this.tick>.2){this.tick=0;for(const n of this.field.nodes){
      if(n.pos.distanceTo(player.pos)>80){n.visible=false;continue;}
      const to=n.pos.clone().sub(player.pos.clone().addScaledVector(player.frame.up,1.5));const distance=to.length();
      n.visible=this.physics.rayDistance(player.pos.clone().addScaledVector(player.frame.up,1.5),to.normalize(),distance)<distance-.35?false:true;
    }}
    this.field.update(dt,player.pos,camera.position,this.forward,n=>n.visible!==false);
    for(const n of this.field.nodes){
      const {obj,energy:e}=n;obj.root.visible=n.pos.distanceToSquared(player.pos)<150*150;
      if(!obj.root.visible&&e<.01)continue;
      obj.m.uniforms.uColor.value.copy(obj.base).lerp(obj.active,e);
      obj.m.uniforms.uGlow.value=e*.65+(n.remembered?.06:0);
      // fluid-woken: blooms through the fluid's tones, then settles back to the world's own colour
      let bloom=0;
      if(n.fluid){
        const f=n.fluid,T=f.tones,x=(f.t+=dt)*.7,i=Math.floor(x)%T.length;
        bloom=1-THREE.MathUtils.smoothstep(f.t,FLUID_BLOOM-2.5,FLUID_BLOOM);
        _tone.copy(T[i]).lerp(T[(i+1)%T.length],THREE.MathUtils.smoothstep(x%1,.3,.7));
        obj.m.uniforms.uColor.value.lerp(_tone,bloom*Math.max(e,.5));
        obj.m.uniforms.uGlow.value=Math.max(obj.m.uniforms.uGlow.value,.85*bloom);
        if(f.t>FLUID_BLOOM)n.fluid=null;
      }
      if(n.sway){n.sway=Math.max(0,n.sway-dt*.7);}
      if(obj.petals){
        const opening=(this.theme.shy?1-e*.62:.35+e*.65)*(1+.6*bloom*(1+.2*Math.sin(t*5)));
        obj.petals.scale.set(opening,1+.5*bloom,opening);
        obj.moving.scale.setScalar(1+.22*bloom);
        obj.moving.rotation.z=Math.sin(t*.9+n.pos.x)*e*.09+Math.sin(t*7)*(n.sway??0)*.35;
        // Turn toward the visitor in the local gravity frame.
        const direction=player.pos.clone().sub(n.pos).applyQuaternion((n.rotation??new THREE.Quaternion()).clone().invert());
        obj.moving.rotation.y=Math.atan2(direction.x,direction.z)*e*.35;
        if(this.theme.spores&&obj.lastEnergy<.5&&e>=.5)this.emit(n);
      }else{
        const which=obj.returning||n.remembered?1:obj.heardElsewhere?2:0;
        obj.texts.forEach((text,i)=>text.visible=e>.38&&i===which);
        obj.moving.rotation.z=(this.theme.kind==='machine'?Math.sin(t*1.4)*e*.045:0)+Math.sin(t*9)*(n.sway??0)*.08;
      }
      obj.lastEnergy=e;
    }
    this.particles=this.particles.filter(p=>{p.life-=dt;p.pos.addScaledVector(p.vel,dt);return p.life>0;});
    this.spores.count=this.particles.length;
    this.particles.forEach((p,i)=>{this.scale.setScalar(Math.min(1,p.life));this.matrix.compose(p.pos,this.quaternion,this.scale);this.spores.setMatrixAt(i,this.matrix);});
    this.spores.instanceMatrix.needsUpdate=true;
    if(this.saveTimer>3){this.flush();this.saveTimer=0;}
  }
}
