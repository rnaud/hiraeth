import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { registerTarget } from './targets.js';
import { slotStorage } from './save-slots.js';
import { runSteps } from './load-steps.js';

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
  references: {kind:'flower',quiet:'#d9b88c',awake:'#71d7cf',radius:9},   // (none grow there: level.reactions false)
  atelier: {kind:'fan',quiet:'#c4beb0',awake:'#8cbdb7',radius:10},
  home: {kind:'flower',quiet:'#d9a37f',awake:'#5fd0c6',radius:9},
  mangrove: {kind:'fungus',quiet:'#8a8ed0',awake:'#ff9ad8',radius:10,shy:true},   // (none grow there: level.reactions false)
  glassdunes: {kind:'fan',quiet:'#8fcfae',awake:'#e8f7a0',radius:10},   // (glass fans in the sand, opening lime as you pass)
  waterfall: {kind:'flower',quiet:'#4f8f5f',awake:'#b2ebe2',radius:9},   // (none grow there: level.reactions false)
  saltharbour: {kind:'flower',quiet:'#e6d2bc',awake:'#c4664a',radius:9},   // (none grow there: level.reactions false)
  antennas: {kind:'flower',quiet:'#9a7ccc',awake:'#ffcf72',radius:9},   // (none grow there: level.reactions false)
  underwater: {kind:'fungus',quiet:'#3f7a74',awake:'#9ff4ee',radius:9},   // (none grow there: level.reactions false)
  eclipse: {kind:'flower',quiet:'#8a7ac8',awake:'#ffb25c',radius:9},   // (none grow there: level.reactions false)
  fallenring: {kind:'flower',quiet:'#9c9e58',awake:'#ef9a7c',radius:9},   // (none grow there: level.reactions false)
  moonfoundry: {kind:'flower',quiet:'#9cc9b4',awake:'#ffd466',radius:9},   // (none grow there: level.reactions false)
  underside: {kind:'flower',quiet:'#c8643e',awake:'#ffb466',radius:9},   // (none grow there: level.reactions false)
  spacecity: {kind:'flower',quiet:'#f0ac94',awake:'#8ef0e4',radius:9},   // (none grow there: level.reactions false)
};

// ------------------------------------------------------------------ room to bloom
// A flower opening (the petals spread with its waking, and further when the traveller's fluid
// makes it bloom) must not open into a wall, a rock or the next flower. Where it is placed, rays
// go out round the bloom (bloomRays); bloomRoom reads them: the flower leans a little away from
// what is close, and its petals open only as wide as the room left. A spot with too little room
// (less than BLOOM.least of the open flower) is given up, or the flower moves a step away first.
export const BLOOM = {
  rays: 12,          // directions round the bloom (at two heights)
  margin: 0.12,      // m kept clear between a petal's tip and anything
  maxTilt: 0.3,      // rad: the furthest a flower leans away from a wall
  wide: 2.1,         // the widest the petals ever spread (fluid bloom: 1.72, the stem's growth: 1.22), × the awake reach
  quiet: 0.35,       // the closed bud's spread (a shy fungus rests fully open: 1)
  least: 0.6,        // a flower needs room to open at least this far (× its reach awake), or it grows elsewhere
};

/**
 * How far a flower can open, and which way it leans. hits: [{ dir: [x, z] (unit, in the ground's
 * plane), d }] the obstacles round the bloom (a ray's free distance, or half the way to the next
 * flower); reach: the petals' reach awake (m), height: the bloom's height above the foot (m).
 * Returns { open (× reach, at most BLOOM.wide), lean: [x, z], angle (rad), sway (0..1, how far the
 * stirred stem may swing), ok (room to open at least BLOOM.least awake, and for the bud at rest) }.
 */
export function bloomRoom(hits, { reach, height, quiet = BLOOM.quiet, margin = BLOOM.margin, maxTilt = BLOOM.maxTilt }) {
  const want = reach + margin;
  let vx = 0, vz = 0;
  for (const h of hits) {
    if (!Number.isFinite(h.d)) continue;
    const w = Math.max(0, 1 - h.d / (want * 1.25)) ** 2;
    vx -= h.dir[0] * w; vz -= h.dir[1] * w;
  }
  const v = Math.hypot(vx, vz);
  const angle = v > 1e-3 ? maxTilt * Math.min(1, v) : 0;
  const lean = v > 1e-3 ? [vx / v, vz / v] : [0, 0];
  const shift = height * Math.sin(angle);
  let free = Infinity;
  for (const h of hits) {
    if (!Number.isFinite(h.d)) continue;
    free = Math.min(free, h.d - shift * (h.dir[0] * lean[0] + h.dir[1] * lean[1]));
  }
  const open = Math.min(BLOOM.wide, Math.max(0, (free - margin) / reach));
  const sway = Number.isFinite(free) ? Math.min(1, Math.max(0.2, (free - margin - reach * Math.min(open, 1)) / (height * 0.45))) : 1;
  return { open, lean, angle, sway, ok: open >= Math.max(quiet, BLOOM.least) };
}

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

// The makers' listening stones (City-Shaft, Signal Market, Hangar): a carved stone on a squat
// plinth, a brass rim round a tall face, three brass-set lenses under it (the three apertures
// that recur on flowers, machines and stones in every world). Waking, the face fills with light
// and shows a glyph in the makers' manner, never a word: the mark itself (three dots over an arc:
// it sees you), the mark doubled (again: it knows you), or the mark under a canopy, like a hand
// cupped to an ear (it has heard of you, from another world).
const GLYPHS={
  see:[['stroke',.44,.78],['mark',0,1.3],['stroke',-.78,-.42]],
  again:[['mark',.4,1.05],['mark',-.36,1.05]],
  heard:[['wave',.8,.4],['wave',.6,.27],['mark',0,1.2],['stroke',-.78,-.44]],
};
/** One glyph, read top to bottom like a line of carved script on the tall face. */
function glyph(kind,material){
  const geo=[],arc=(r,A,x,y)=>new THREE.TorusGeometry(r,.03,4,16,A).rotateZ(Math.PI/2-A/2).scale(1,1,.5).translate(x,y,0);
  for(const [part,a,b] of GLYPHS[kind]){
    if(part==='mark'){   // the makers' mark: three dots over an arc
      for(const [x,y] of [[-.15,.1],[0,.16],[.15,.1]])geo.push(new THREE.SphereGeometry(.052*b,8,6).scale(1,1,.5).translate(x*b,a+y*b,0));
      geo.push(arc(.4*b,1.05,0,a-.34*b));
    }else if(part==='stroke')geo.push(new THREE.BoxGeometry(.05,b-a,.03).translate(0,(a+b)/2,0));
    else geo.push(arc(b,1.4,0,a-b));   // a ripple over the mark: heard, from far off
  }
  return new THREE.Mesh(mergeGeometries(geo),material);
}
function reactiveMaterial(color){
  const base=makeMaterial({color,flat:true,side:THREE.DoubleSide});
  const m=base.clone();m.uniforms={...base.uniforms,uColor:{value:new THREE.Color(color)},uGlow:{value:0}};return m;
}
function objectFor(theme,screen=false){
  const root=new THREE.Group();root.userData.noCollide=true;
  const m=reactiveMaterial(theme.quiet),metal=makeMaterial({color:'#617371',flat:true,metal:'iron'}),ink=makeMaterial({color:'#34494d',flat:true});
  const moving=new THREE.Group(),lean=new THREE.Group();root.add(lean);lean.add(moving);   // (lean: away from a wall, bloomRoom)
  let texts=[],petals=null;
  if(screen||theme.kind==='screen'||theme.kind==='machine'){
    const stone=makeMaterial({color:'#e6dabb',flat:true}),brass=makeMaterial({color:'#c99d48',flat:true,metal:'brass'});
    if(!screen){   // (a billboard in the market wears only the face, as a medallion)
      const plinth=new THREE.Mesh(new THREE.CylinderGeometry(.34,.5,1.75,7),stone);plinth.position.y=.875;root.add(plinth);
      const foot=new THREE.Mesh(new THREE.CylinderGeometry(.62,.66,.16,7),stone);foot.position.y=.08;root.add(foot);
      const collar=new THREE.Mesh(new THREE.CylinderGeometry(.42,.38,.16,14),brass);collar.position.y=1.72;root.add(collar);
      const neck=new THREE.Mesh(new THREE.CylinderGeometry(.22,.32,.32,7),stone);neck.position.y=1.88;moving.add(neck);
    }
    // the carved head: a tall stone, pointed like a seed, the face sunk in it behind a brass rim
    const head=new THREE.Mesh(new THREE.CylinderGeometry(1,1,.34,20).rotateX(Math.PI/2).scale(.66,1.3,1),stone);head.position.y=2.7;moving.add(head);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(1,.07,5,30).scale(.56,1.18,1),brass);rim.position.set(0,2.7,.17);moving.add(rim);
    const face=new THREE.Mesh(new THREE.CircleGeometry(1,30).scale(.52,1.14,1),m);face.position.set(0,2.7,.175);moving.add(face);
    for(const side of [-1,1]){const ear=new THREE.Mesh(new THREE.SphereGeometry(.2,8,6).scale(.5,1.3,.7),brass);ear.position.set(side*.68,2.7,0);moving.add(ear);}
    const crown=new THREE.Mesh(new THREE.ConeGeometry(.15,.42,6),brass);crown.position.y=4.18;moving.add(crown);
    const textMat=makeMaterial({color:'#2f3d40',flat:true,glow:.6});
    // first meeting, a return, heard of from another world (the order the update picks them in)
    texts=['see','again','heard'].map(kind=>{const mesh=glyph(kind,textMat);mesh.position.set(0,2.7,.2);mesh.visible=false;moving.add(mesh);return mesh;});
    // the three apertures: lenses of the face's own light, set in brass under the face
    for(let i=-1;i<=1;i++){
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.11,.035,4,12),brass);ring.position.set(i*.36,1.72-(Math.abs(i)?.02:0),.37);if(screen)ring.position.set(i*.3,1.28,.12);moving.add(ring);
      const lens=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6).scale(1,1,.6),m);lens.position.copy(ring.position);moving.add(lens);
    }
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
  // the petals' reach (local, round the stem) and the bloom's top, for the room they need
  let reach=0,top=0;
  if(petals){const P=petals.children[0].geometry.attributes.position;for(let i=0;i<P.count;i++)reach=Math.max(reach,Math.hypot(P.getX(i),P.getZ(i)));top=1.65;}
  return {root,m,moving,lean,petals,texts,reach,top,base:new THREE.Color(theme.quiet),active:new THREE.Color(theme.awake),lastEnergy:0};
}

export class ReactiveWorld {
  constructor(...a){runSteps(this.steps(...a));}
  /** Built a seed's flowers (or screens) a step: `yield* ReactiveWorld.make(...)` (src/load-steps.js). */
  static *make(...a){const w=Object.create(ReactiveWorld.prototype);yield* w.steps(...a);return w;}
  *steps(scene,level,physics,content,{storage=slotStorage}={}){
    this.theme=WORLD_REACTIONS[level.id];this.storage=storage;this.level=level;this.physics=physics;
    this.root=new THREE.Group();this.root.name='Responsive world';this.root.userData.noCollide=true;scene.add(this.root);
    this.key='moebius.encounters.v1';let saved={};try{saved=JSON.parse(storage?.getItem(this.key)??'{}');}catch{}
    this.saved=saved;this.nodes=[];this.particles=[];this.tick=.21;this.dirty=false;this.saveTimer=0;
    const seeds=[{pos:level.spawn.clone(),up:UP}];
    for(const npc of content.npcs??[])seeds.push({pos:new THREE.Vector3(npc.at[0],npc.y??level.spawn.y,npc.at[1]),up:UP});
    for(let i=1;i<=5;i++)seeds.push({pos:level.spawn.clone().add(new THREE.Vector3(i%2?12:-12,0,-i*30)),up:UP});
    if(level.id==='bazaar')for(let i=0;i<8;i++)seeds.push({pos:new THREE.Vector3(i%2?18:-18,0,80-i*53),up:UP});
    // Portal endpoints provide a local frame even on the Hangar's ceiling/ring.
    for(const p of level.navigationPortals??[])if(!p.temple)seeds.push({pos:p.to.clone(),up:p.toUp.clone()});   // (not into a temple's rooms)
    const goal=content.story.goal;
    if(typeof goal[1]==='number')seeds.push({pos:new THREE.Vector3(...goal),up:level.gravityAt?.(new THREE.Vector3(...goal))??UP});
    else if(Number.isFinite(level.ground.heightAt(goal[0],goal[2])))seeds.push({pos:new THREE.Vector3(goal[0],level.ground.heightAt(goal[0],goal[2]),goal[2]),up:UP});
    for(const s of content.relics.spots){const a=Array.isArray(s)?s:s.at;const x=a[0],z=a.length===2?a[1]:a[2];const y=a.length===2?level.ground.heightAt(x,z):a[1];if(Number.isFinite(y))seeds.push({pos:new THREE.Vector3(x,y,z),up:level.gravityAt?.(new THREE.Vector3(x,y,z))??UP});}
    if(level.id==='bazaar'){
      seeds.length=0;
      for(let i=0;i<8;i++)seeds.push({pos:new THREE.Vector3(i%2?23:-23,0,95-i*54),up:UP});
    }
    if(level.reactions===false)seeds.length=0;   // (a world kept as it is drawn: the references)
    for(const [i,seed] of seeds.slice(0,28).entries()){
      yield;
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
    }
    yield;
    this.fitBlooms();
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
    // a flower: room to open round its bloom, or a step away from the wall, or not here at all
    let rays=null;
    if(obj.petals){
      for(let tries=0;;tries++){
        rays=this.bloomRays(pos,up,obj);
        const room=rays&&bloomRoom(rays.hits,this.bloomSize(obj));
        if(room?.ok)break;
        if(tries>=2||!room||room.angle===0){this.dropped=(this.dropped??0)+1;return false;}
        // a step away from what is close, then down onto the ground there
        const away=rays.t1.clone().multiplyScalar(room.lean[0]).addScaledVector(rays.t2,room.lean[1]);
        const moved=pos.clone().addScaledVector(away,obj.reach*obj.root.scale.x*.8+.4);
        const hit=this.physics.rayHit(moved.clone().addScaledVector(up,3),up.clone().negate(),8);
        if(!hit||this.level.unsafe?.(hit.point)){this.dropped=(this.dropped??0)+1;return false;}
        pos=hit.point;
      }
    }
    obj.root.position.copy(pos);obj.root.quaternion.copy(rotation);
    obj.root.rotateY(index*.65);this.root.add(obj.root);
    this.nodes.push({pos:pos.clone().addScaledVector(up,1.3),foot:pos.clone(),radius:this.theme.radius,cluster,obj,up:up.clone(),rotation:rotation.clone(),rays});
    return true;
  }
  /** The petals' reach awake and the bloom's height (m), for bloomRoom. */
  bloomSize(obj){return {reach:obj.reach*obj.root.scale.x,height:1.2*obj.root.scale.y,quiet:this.theme.shy?1:BLOOM.quiet};}
  /**
   * Rays out round a flower's bloom (in the ground's plane, at the bloom and a little above, for
   * the petals' tips) and up over it. null: something is right over the flower (no room to stand).
   */
  bloomRays(pos,up,obj){
    const s=obj.root.scale,size=this.bloomSize(obj),far=size.reach*BLOOM.wide+BLOOM.margin+.3;
    const t1=new THREE.Vector3(1,0,0);if(Math.abs(up.x)>.9)t1.set(0,0,1);t1.addScaledVector(up,-t1.dot(up)).normalize();
    const t2=new THREE.Vector3().crossVectors(up,t1),dir=new THREE.Vector3(),o=new THREE.Vector3();
    const overhead=this.physics.rayDistance(o.copy(pos).addScaledVector(up,.3),up,obj.top*s.y*1.25+.3)+.3;
    if(overhead<obj.top*s.y+BLOOM.margin)return null;
    const hits=[];
    for(let k=0;k<BLOOM.rays;k++){
      const a=k*Math.PI*2/BLOOM.rays,c=Math.cos(a),sn=Math.sin(a);dir.copy(t1).multiplyScalar(c).addScaledVector(t2,sn);
      let d=Infinity;
      for(const y of [1.2,1.5])d=Math.min(d,this.physics.rayDistance(o.copy(pos).addScaledVector(up,y*s.y),dir,far));
      hits.push({dir:[c,sn],d});
    }
    return {hits,overhead,t1,t2};
  }
  /**
   * Once every flower is placed: each also keeps clear of its neighbours (of the next one's petals
   * open awake, or half the way to it), leans away from what is close and keeps to the room left.
   * A flower with no room even for its bud between the others is left out.
   */
  fitBlooms(){
    const flowers=this.nodes.filter(n=>n.obj.petals&&n.rays);
    const rel=new THREE.Vector3();
    for(const n of flowers){
      const size=this.bloomSize(n.obj),hits=[...n.rays.hits];
      for(const o of flowers){
        if(o===n||!this.nodes.includes(o))continue;
        rel.subVectors(o.foot,n.foot);const along=rel.dot(n.up);rel.addScaledVector(n.up,-along);
        const d=rel.length(),reachO=this.bloomSize(o.obj).reach;
        if(d<1e-3||Math.abs(along)>2||d>(size.reach+reachO)*BLOOM.wide+.5)continue;
        hits.push({dir:[rel.dot(n.rays.t1)/d,rel.dot(n.rays.t2)/d],d:Math.max(d/2,d-reachO)});
      }
      const room=bloomRoom(hits,size);
      if(!room.ok){n.obj.root.removeFromParent();this.nodes.splice(this.nodes.indexOf(n),1);this.crowded=(this.crowded??0)+1;continue;}
      n.room=room;n.reach=size.reach;
      // the lean, in the flower's own frame (it is turned round its stem and scaled)
      if(room.angle>0){
        const w=n.rays.t1.clone().multiplyScalar(room.lean[0]).addScaledVector(n.rays.t2,room.lean[1]).applyQuaternion(n.obj.root.quaternion.clone().invert());
        const axis=new THREE.Vector3(w.z,0,-w.x).normalize();
        n.obj.lean.quaternion.setFromAxisAngle(axis,room.angle);
      }
    }
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
        let opening=(this.theme.shy?1-e*.62:.35+e*.65)*(1+.6*bloom*(1+.2*Math.sin(t*5)));
        // only as wide as the room round it (bloomRoom): the stem's growth first, then the petals
        const room=n.room,grow=Math.min(1+.22*bloom,room?Math.max(1,(n.rays.overhead-BLOOM.margin)/(obj.top*obj.root.scale.y)):Infinity);
        if(room)opening=Math.min(opening,room.open/grow);
        obj.petals.scale.set(opening,1+.5*bloom,opening);
        obj.moving.scale.setScalar(grow);
        obj.moving.rotation.z=(Math.sin(t*.9+n.pos.x)*e*.09+Math.sin(t*7)*(n.sway??0)*.35)*(room?.sway??1);
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
