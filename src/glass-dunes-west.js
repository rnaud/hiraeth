import * as THREE from 'three';
import { RoomKit } from './levels/lab-kit.js';
import { glassRidge,glassBatch,glassOptions } from './levels/glass-dunes-kit.js';
import { GLASS_ATTR, GLASS_DEFAULT } from './dune-glass-shader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { quarterMaterials } from './glass-dunes-quarter.js';
import { terrace,windingStair,box } from './glass-dunes-architecture.js';
import { stoneBridge,pillarGallery,streetHouse } from './glass-dunes-civic-kit.js';
import { clock } from './glass-dunes-frozen.js';
import { massMaterials, roundTower, squareTower, paleFloor, crystalColumn, floorMaterial, rubble } from './glass-dunes-masses.js';

// The far west, behind the giants' cliff (issue #426): one way north from the red cleft's arch, by the folded ravine
// (its south mouth near the cleft, its north mouth on the square where the giants' passage comes out), the prism
// crossings, to the pearl city in the north-west, whose east side opens on the gap between the giants and the
// breaker, back down into the north valley. Two loops: round by the cleft, or through the giants' passage.
export const FOLDED={x:-330,z:120},PRISM={x:-330,z:-55},PEARL={x:-330,z:-206};
const at=(q,base)=>(x,y,z)=>[q.x+x,base+y,q.z+z];

function folded(kit,M,ground,routes,walks){
  const q=FOLDED,base=ground.heightAt(q.x,q.z),p=at(q,base),batch=glassBatch(kit);
  const mat=kit.mat(glassOptions({shadeFlat:.25,glow:.07,duneGlass:{mint:'#82baaa',lime:'#b8d8bd',rim:.5}}));
  for(const [side,path] of [[-1,[[-24,72],[-24,30],[-23,-10],[-25,-71]]],[1,[[24,-73],[26,-28],[23,20],[26,73]]]]){
    const r=glassRidge({H:(x,z)=>ground.heightAt(x,z),path:path.map(([x,z])=>[q.x+x,q.z+z]),height:side<0?146:154,depth:32,profile:'cliff',ends:18,step:1.5,rows:56,seed:710+side,folds:{width:7,amp:3.3,lean:.13,crest:.08},colours:{foot:'#4b8571',mid:'#2e7564',top:'#205446',crest:'#79a98c'}});
    // Above the paths the sheets lean together into a tall tapered slit.
    const pos=r.geo.attributes.position;
    for(let k=0;k<pos.count;k++){const y=pos.getY(k)-base,t=Math.min(1,Math.max(0,(y-65)/80));pos.setX(k,pos.getX(k)-side*(side<0?22:18)*t*t*(3-2*t));}
    r.geo.computeVertexNormals();batch.add(mat,r.geo);
  }
  const cliffMeshes=batch.finish();kit.group.updateMatrixWorld(true);
  const chalk=kit.mat(glassOptions({color:'#dcf1f4',vertexColors:false,line:.4,hatch:.1,shadeFlat:.2,shade:.25,glow:.1,duneGlass:{mint:'#a9d8e4',lime:'#f2fbff',rim:.4,band:[.48,.82],deep:.5}}));const S={stone:chalk,step:chalk};
  const lower=[p(-14,0,54),p(-10,8,34),p(-16,16,13),p(-11,24,-2.5),p(-11,24,-7)];lower[0][1]=ground.heightAt(lower[0][0],lower[0][2])+.05;
  // The plate's stair is a massive pale flight climbing the cliff: solid to the sand, wide, walled.
  windingStair(kit,S,routes,lower,{w:8,base:base-6,outer:true,rail:.9});
  terrace(kit,chalk,{x:q.x-11,z:q.z-7,y:base,h:24,rx:5,rz:5});
  windingStair(kit,S,routes,[p(-11,24,-7),p(-16,32,-28),p(-12,40,-44),p(-12,40,-49)],{w:7.5,base:base-6,outer:true,rail:.9});
  terrace(kit,chalk,{x:q.x-12,z:q.z-51,y:base,h:40,rx:5.5,rz:5.5});
  // A single return flight follows the upper left cliff, never spiralling through the void.
  const high=[p(-12,40,-49),p(-12,40,-58),p(-18,40,-60),p(-20,40,-52)];
  for(const [yy,zz] of [[50,-35],[65,-12],[78,9],[92,29],[105,36],[112,48],[112,55]]){
    const ray=new THREE.Raycaster(new THREE.Vector3(q.x+10,base+yy,q.z+zz),new THREE.Vector3(-1,0,0),0,80),hit=ray.intersectObjects(cliffMeshes,false)[0];
    const xx=hit?hit.point.x-q.x+3.8:-12;
    high.push(p(xx,yy,zz));
  }
  // Up to 65 m as one flight; from there the stair broadens into the plate's massive pale body, 16 m wide and
  // 30 m deep, climbing the cliff (high enough over the flights below that its mass never reaches them).
  const split=high.findIndex(v=>v[1]-base>=64);
  windingStair(kit,S,routes,high.slice(0,split+1),{w:8,thin:true,thickness:10,viaSamples:40,refine:true,outer:true,rail:.9});
  const broad=high.slice(split).map((v,i)=>i===0?v:[v[0]+4,v[1],v[2]]);
  windingStair(kit,S,routes,broad,{w:16,thin:true,thickness:30,viaSamples:40,refine:true,outer:true,rail:1.1});
  const summit=broad.at(-1);
  terrace(kit,chalk,{x:summit[0],z:summit[2],y:summit[1]-1,h:1,rx:3,rz:3});
  // (the span's parapets start at the drums' edges, clear of the flights arriving on them)
  walks.push(stoneBridge(kit,S,{from:p(-6.2,24,-7),to:p(9.7,24,-7),w:5,drop:9,rail:.9}));
  terrace(kit,chalk,{x:q.x+14,z:q.z-7,y:base,h:24,rx:4.5,rz:4.5});
  const down=[p(14,24,-7),p(14,24,-11.5),p(13,16,-29),p(10,8,-46),p(14,0,-65)];down.at(-1)[1]=ground.heightAt(down.at(-1)[0],down.at(-1)[2])+.05;
  windingStair(kit,S,routes,down,{w:6,base:base-6,inner:true,outer:false,rail:.9});
  // Wall ribs meet the underside of the winding stair, below its walking surface.
  // Under the flights the stair's mass runs back into the cliff: one pale body from the sand up.
  for(const pts of [lower,[p(-11,24,-7),p(-16,32,-28),p(-12,40,-44)]]){
    const path=new THREE.CatmullRomCurve3(pts.map(v=>new THREE.Vector3(...v)));
    for(let i=0;i<=24;i++){const v=path.getPoint(i/24),top=v.y-base-.7;if(top<1)continue;const x0=-27,x1=v.x-q.x-2.5;if(x1<=x0)continue;box(kit,chalk,q.x+(x0+x1)/2,base+top/2,v.z,x1-x0,top,3.4);}
  }
  // a pale floor down the ravine: the plates' bright ground under the dark walls
  paleFloor(kit,floorMaterial(kit,['#eef1ea','#e6eae2','#dde3da']),ground,{x:q.x,z:q.z,w:44,d:150,round:.7});
  // fallen pale blocks on the open side of the floor, off the lane, the drums and the flight down
  rubble(kit,chalk,ground,{x:q.x+13,z:q.z+36,r:34,n:50,seed:730,size:1.2,clear:(x,z)=>x<q.x+5||x>q.x+21||z<q.z+1||z>q.z+72});
  return{base,entry:p(0,0,74),exit:p(0,0,-75),view:{eye:p(1,3.7,72),target:p(-7,49,-5),fov:68},summit,stairMaterial:chalk};
}

/**
 * The prism walls (prism-cleft-1, -3): crowded faceted crystal columns, 5-7 flat faces each in its own
 * shade of green, tops cut on a slant, two ranks deep, so each side of the cleft is a cliff of facets.
 */
function prismWall(kit,mat,q,base,side){
  const tones=['#1f6a55','#3f9273','#6db890','#94d4a8','#2d7d63','#b6e6c0'],geoms=[];
  let seed=side>0?500:700;
  for(const [rank,front,r0,h0] of [[0,25,6,62],[1,35,8,84],[2,48,9.5,112]])for(let z=78;z>-96;z+=0){
    const r=r0*(.65+.7*((seed*7919)%13)/13),h=h0*((rank?.6:.75)+.7*((seed*104729)%17)/17);
    crystalColumn(geoms,{x:q.x+side*(front+r*.7+(seed%3)),y:base,z:q.z+z-r,r,h,seed:seed++,tones,lean:.04});
    z-=r*1.35;
  }
  const g=mergeGeometries(geoms);g.computeBoundingSphere();
  const m=kit.mesh(g,mat);m.name='Faceted prism columns';
}

/** A crystal arch over the lane: two faceted piers and a pointed lintel of glass blocks. */
function prismArch(kit,mat,q,base,{z,w=14,h=26}){
  const geoms=[],tones=['#5ea586','#8fcfa4','#3f8f72','#b5e2bf'];
  for(const side of [-1,1])for(let k=0;k<3;k++)crystalColumn(geoms,{x:q.x+side*(w/2+2.5+k*1.5),y:base,z:q.z+z+(k-1)*2.2,r:2.6,h:h+k*4-2,seed:880+k+side*5,tones,lean:.02});
  // the lintel: slanted blocks meeting over the middle
  for(const side of [-1,1]){
    const g=new THREE.BoxGeometry(w*.62,3,4).rotateZ(side*-.55).translate(q.x+side*w*.24,base+h-.5,q.z+z);
    const n=g.attributes.position.count,c=new THREE.Color('#7cc29a'),col=[],a=[];for(let i=0;i<n;i++){col.push(c.r,c.g,c.b);a.push(100,.25,.75,.9);}
    g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setAttribute(GLASS_ATTR,new THREE.Float32BufferAttribute(a,4));g.deleteAttribute('uv');geoms.push(g.toNonIndexed());
  }
  const g=mergeGeometries(geoms);
  g.computeBoundingSphere();kit.mesh(g,mat).name='Crystal arch';
}

function prism(kit,M,ground,routes,walks){
  const q=PRISM,base=ground.heightAt(q.x,q.z),p=at(q,base);
  const mat=kit.mat(glassOptions({shadeFlat:.4,glow:.1,line:.7,duneGlass:{mint:'#8fd3aa',lime:'#c9eebf',rim:.55}}));
  prismWall(kit,mat,q,base,-1);prismWall(kit,mat,q,base,1);
  prismArch(kit,mat,q,base,{z:-86,w:26,h:30});
  // the bright sand floor of the plates
  paleFloor(kit,floorMaterial(kit,['#f3c162','#eeb552','#f6cf7c']),ground,{x:q.x,z:q.z-15,w:48,d:180,round:.7});
  const stone=kit.mat({color:'#c4d5b8',line:.65,hatch:.2,shade:.3,shadeHue:.8}),S={stone,step:stone};
  const a=[p(-13,0,45),p(-13,8,25),p(-10,11,14),p(12,22,-12),p(15,28,-28)];a[0][1]=ground.heightAt(a[0][0],a[0][2])+.05;
  windingStair(kit,S,routes,a,{w:5,thin:true,thickness:3,outer:true,rail:.9,railGaps:[{at:p(12,22,-12),r:7}]});
  terrace(kit,stone,{x:q.x+15,z:q.z-29,y:base+27.2,h:.8,rx:4.3,rz:4});
  walks.push(stoneBridge(kit,S,{from:p(15,28,-28),to:p(-14,28,-28),w:5.5,drop:11,rail:1}));
  terrace(kit,stone,{x:q.x-14,z:q.z-29,y:base+27.2,h:.8,rx:3.5,rz:4});
  const b=[p(-14,28,-28),p(-14,28,-34),p(-13,18,-53),p(-10,8,-71),p(-9,0,-89)];b.at(-1)[1]=ground.heightAt(b.at(-1)[0],b.at(-1)[2])+.05;
  windingStair(kit,S,routes,b,{w:4.6,thin:true,thickness:3,outer:true,rail:.9});
  // A second stair branches at the crossing into a lower eastern terrace.
  const c=[p(12,22,-12),p(12,22,-7.5),p(17,14,11),p(12,7,30),p(13,0,51)];c.at(-1)[1]=ground.heightAt(c.at(-1)[0],c.at(-1)[2])+.05;
  windingStair(kit,S,routes,c,{w:4.4,thin:true,thickness:3,inner:true,outer:false,rail:.9,railGaps:[{at:p(12,22,-12),r:7}]});
  terrace(kit,stone,{x:q.x+12,z:q.z-12,y:base+21.2,h:.8,rx:3.3,rz:3.3});
  return{base,entry:p(0,0,63),exit:p(0,0,-94),view:{eye:p(-1,5,56),target:p(0,24,-17),fov:64}};
}

/**
 * The pearl castle (pearl-labyrinth-3): stacked pale towers, round and square, with scalloped tops and
 * small deep openings, rising 40-80 m behind the galleries against the dark glass. Scenery only: it
 * stands behind the upper gallery, off every walk.
 */
function pearlCastle(kit,M,q,base){
  const C=massMaterials(kit,{stone:kit.mat({color:'#f6f5ee',line:.6,weathered:.9,detail:'built',detailDensity:.5,patches:.55,hatch:.18,shade:.3,shadeHue:.45}),trim:kit.mat({color:'#dfe2d6',line:.55,weathered:.7,detail:'built',hatch:.2,shade:.3,shadeHue:.45})});
  const P=(x,z)=>[q.x+x,q.z+z],foot=base-6;
  // the far, tallest masses first, then the nearer ones stepping down toward the galleries
  for(const [x,z,w,d,h,steps,seed] of [[-6,-56,15,8,74,3,1],[6,-50,12,10,64,3,2],[24,-50,11,9,58,2,3],[-27,-40,12,11,44,2,4],[33,-44,9,8,40,2,5]]){const [px,pz]=P(x,z);squareTower(kit,C,{x:px,y:foot,z:pz,w,d,h,seed:910+seed,steps});}
  for(const [x,z,r,h,upper,seed] of [[-15,-47,7.5,50,16,1],[16,-43,5.5,40,12,2],[31,-33,6,34,10,3],[-37,-24,6.5,32,0,4],[-22,-52,5,58,12,5],[0,-45,4.5,38,0,6]]){const [px,pz]=P(x,z);roundTower(kit,C,{x:px,y:foot,z:pz,r,h,upper,seed:930+seed});}
  // curtain walls joining their feet, with scalloped tops
  for(const [x,z,w,h,yaw] of [[-8,-44,30,20,0],[22,-40,14,16,0],[-31,-31,4,22,0],[-30,-44,12,26,Math.PI/2]]){const [px,pz]=P(x,z);squareTower(kit,C,{x:px,y:foot,z:pz,w,d:3,h,yaw,steps:1,seed:950+x,windows:.3});}
}

function pearl(kit,M,ground,glassMat,routes,walks){
  M={...M,stone:kit.mat({color:'#eff0e8',line:.6,weathered:.95,detail:'built',detailDensity:.65,patches:.6,hatch:.16,shade:.3,shadeHue:.45}),trim:kit.mat({color:'#d9ddd0',line:.55,weathered:.8,detail:'built',hatch:.2,shade:.28,shadeHue:.45})};
  const q=PEARL,base=Math.max(...[-35,0,35].flatMap(x=>[-35,0,35].map(z=>ground.heightAt(q.x+x,q.z+z))))+.08,p=at(q,base);
  // the plaza: pale stone whose shade stays light, as the plate's floor
  terrace(kit,kit.mat({color:'#eef0e8',line:.5,hatch:.2,weathered:.6,detail:'built',detailDensity:.4,shade:.6}),{x:q.x,z:q.z,y:base-4,h:4,rx:41,rz:43});
  const entry=p(0,0,57);entry[1]=ground.heightAt(entry[0],entry[2]);
  windingStair(kit,M,routes,[entry,p(0,0,41)],{w:8,inner:false,outer:false,base:Math.min(entry[1],base)-.5});
  // the way out east, to the gap between the giants and the breaker: a broad stair down off the plaza's rim
  const east=p(56,0,-17);east[1]=ground.heightAt(east[0],east[2])+.05;
  windingStair(kit,M,routes,[p(35,0,-17),east],{w:8,inner:false,outer:false,base:Math.min(east[1],base)-.5});
  const A={x:-15,z:-3,y:9,rx:13,rz:10},B={x:14,z:-14,y:16,rx:16,rz:12},C={x:0,z:-30,y:24,rx:11,rz:10};
  for(const g of [A,B,C])pillarGallery(kit,M,{...g,x:q.x+g.x,z:q.z+g.z,y:base+g.y,base});
  const a=[p(-30,0,26),p(-30,4.5,13),p(-28,9,-3),p(-24,9,-3)];windingStair(kit,M,routes,a,{w:3.5,thin:true,outer:true,rail:.65});
  const b=[p(-5,9,0),p(0,12.5,4),p(10,16,-4)];windingStair(kit,M,routes,b,{w:3.4,thin:true,outer:true,rail:.65});
  const c=[p(1,16,-10),p(-7,20,-13),p(-8,24,-23.1)];windingStair(kit,M,routes,c,{w:3.2,thin:true,inner:true,outer:false,rail:.65});
  walks.push([p(-24,9,-3),p(-5,9,0)],[p(10,16,-4),p(1,16,-10)],[p(-8,24,-23.1),p(-8,24,-28)],[p(-8,24,-28),p(-3,24,-28)]);
  // Close ground lanes and upper rooms share walls; the galleries overhang them.
  const houses=[[-23,22,0,9,8,11],[-14,23,0,9,9,7],[9,24,0,10,8,5],[28,19,0,9,10,6],[-35.5,4,0,6,8,18],[-19,-9,9,8,7,14],[-9,-7,9,7,7,8],[18,-18,16,9,8,13],[7,-20,16,7,7,10],[1,-34,24,8,7,12],[29,-7,0,8,9,11],[-22,-28,0,10,9,20]];
  for(const [i,[x,z,y,w,d,h]] of houses.entries())streetHouse(kit,M,{x:q.x+x,z:q.z+z,y:base+y,w,d,h,seed:i,pearl:true});
  // One low arch joins two street edges below the raised walks.
  walks.push(stoneBridge(kit,M,{from:p(-23,6,11),to:p(-7,6,11),w:3.2,drop:3.2,rail:.6,scallop:.45}));
  // This lower span has a separate climb so all visible terraces can be reached.
  windingStair(kit,M,routes,[p(-7,0,28),p(-5,3,19),p(-7,6,11)],{w:3,thin:true,outer:true,rail:.6});
  terrace(kit,M.stone,{x:q.x-23,z:q.z+11,y:base+5.3,h:.7,rx:3,rz:3});
  // A slender, asymmetrical stopped clock is scenery, separate from the Clock-House.
  // A slender stopped clock, scenery (not the Clock-House), climbing out of the upper gallery past the castle's tops.
  const towerX=q.x+5,towerZ=q.z-31;
  box(kit,M.stone,towerX,base+24+7,towerZ,3.4,14,3.8);
  box(kit,M.stone,towerX,base+38+20,towerZ,2.3,40,2.3);
  box(kit,M.trim,towerX,base+77.5,towerZ,3.6,1,3.6);
  box(kit,M.stone,towerX,base+81,towerZ,2.6,6,2.6);
  box(kit,M.trim,towerX,base+84.4,towerZ,3.2,.8,3.2);
  box(kit,M.stone,towerX,base+86.5,towerZ,1.2,3.4,1.2);
  const face=clock({minute:7,kind:'round'}),m=new THREE.Matrix4().makeTranslation(towerX,base+80.6,towerZ+1.32).multiply(new THREE.Matrix4().makeScale(1.05,1.05,1.05));
  const ink=kit.mat({color:'#507165',line:.4}),dial=kit.mat({color:'#e6ecdc',line:.4});
  kit.add(dial,face.face.applyMatrix4(m));kit.add(ink,face.hands.applyMatrix4(m));kit.add(M.trim,face.body.applyMatrix4(m));
  pearlCastle(kit,M,q,base);
  const batch=glassBatch(kit),mat=kit.mat(glassOptions({shadeFlat:.35,glow:.04,line:.45,duneGlass:{mint:'#6fae9f',lime:'#a9d2c0',rim:.35}}));
  // Tall dark glass slabs stand close round the castle (pearl-labyrinth-3): its pale masses against them.
  // (the east side open from the back to the middle: the way on to the gap)
  const cliffs=[[[-47,52],[-47,0],[-45,-62]],[[40,-6],[44,42]],[[-46,-63],[0,-66],[40,-63]]];
  for(const [i,path] of cliffs.entries())batch.add(mat,glassRidge({H:(x,z)=>ground.heightAt(x,z),path:path.map(([x,z])=>[q.x+x,q.z+z]),height:i===2?125:98,depth:24,profile:'cliff',ends:20,seed:760+i,rows:56,step:2,folds:{width:15,amp:2.4,lean:.05,crest:.06},colours:{foot:'#3f7a70',mid:'#245a55',top:'#1b4a48',crest:'#6f9f94'}}).geo);
  batch.finish();
  return{base,entry,exit:east,view:{eye:p(-1,5,49),target:p(0,24,-15),fov:62}};
}

export function buildWesternDunes(scene,ground,glassMat){
  const group=new THREE.Group();group.name='The western glass — folded ravine, prism crossings and pearl city';scene.add(group);
  const routes=[],walks=[];
  // One kit (one set of merged meshes) per place, so each is culled on its own when out of view.
  const area=(name,seed,fn)=>{const g=new THREE.Group();g.name=name;group.add(g);const kit=new RoomKit({group:g,ground,centre:new THREE.Vector3(),seed});const out=fn(kit,quarterMaterials(kit));kit.finish();for(const m of kit.noShadow)m.userData.castShadow=false;return out;};
  const fold=area('the folded ravine',710,(kit,M)=>folded(kit,M,ground,routes,walks));
  const prisms=area('the prism crossings',711,(kit,M)=>prism(kit,M,ground,routes,walks));
  const city=area('the pearl city',712,(kit,M)=>pearl(kit,M,ground,glassMat,routes,walks));
  // RoomKit removes custom attributes while merging. Write the glass defaults on
  // the finished stair mesh explicitly: Unity cannot use WebGL's constant attributes.
  group.traverse(o=>{if(o.isMesh&&o.material===fold.stairMaterial){
    const count=o.geometry.attributes.position.count,data=new Float32Array(count*4);
    for(let i=0;i<count;i++)data.set(GLASS_DEFAULT,i*4);
    o.geometry.setAttribute(GLASS_ATTR,new THREE.BufferAttribute(data,4));
  }});
  const areas=[{...FOLDED,w:65,d:80},{...PRISM,w:65,d:99},{...PEARL,w:75,d:70}];
  return{group,routes,walks,folded:fold,prism:prisms,pearl:city,
    avoid:(x,z,r=0)=>areas.some(a=>Math.abs(x-a.x)<a.w+r&&Math.abs(z-a.z)<a.d+r),
    sights:[{name:'the folded ravine',at:fold.entry},{name:'the prism crossings',at:prisms.entry},{name:'the pearl city',at:city.entry}]};
}
