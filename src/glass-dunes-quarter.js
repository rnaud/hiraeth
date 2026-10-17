import * as THREE from 'three';
import { ruinedFacade } from './glass-dunes-ruins.js';
import { RoomKit } from './levels/lab-kit.js';
import { glassRidge, glassBatch, glassPassage, glassOptions, withoutDrifts } from './levels/glass-dunes-kit.js';
import { cellularRidge, cellularVault, glassCave } from './glass-dunes-enclosures.js';
import { box, terrace, dwelling, opening, ellipseOpenings, ribbonWall, arcPoints, windingStair, glassFold, ruinWall, wallGrowth } from './glass-dunes-architecture.js';
import { massMaterials, hole, lump, rockDwelling, paleFloor, rubble, cottage, floorMaterial } from './glass-dunes-masses.js';

// Optional scenery only: quest positions, temple, named people and original dunes are untouched.
// The city-sized cavern sits beyond the cairn approach, keeping its amber posts in sight.
// Where each place stands (issue #426, the relayout): the painted quarter by the giants' cliff on the way from the
// ship to the west camp, its stairs facing the landing; the red cleft south-west of the ship, the way round the
// giants' south end to the west (its arch opens north, behind the cliff); the half-buried court dug into the corner
// where the billows meet the breaker, its mouth turned west to the north valley (yaw: the place built facing +z,
// then turned about its anchor).
export const QUARTER={x:-128,z:192}, CLEFT={x:-238,z:266}, COURT={x:282,z:-150,yaw:-Math.PI/2};
/** A point of a turned place: built about its anchor facing +z (x, z in that frame), where it stands in the world. */
export function placed(q){
 const c=Math.cos(q.yaw??0),s=Math.sin(q.yaw??0);
 return (x,y,z)=>[q.x+(x-q.x)*c+(z-q.z)*s,y,q.z-(x-q.x)*s+(z-q.z)*c];
}
export const QUARTER_COLORS={stone:'#f0e9d5',trim:'#ded6bd',blue:'#275c94',coral:'#cf8171',plum:'#76516e',red:'#bb5038',gold:'#bc9a56',ochre:'#ba9a59',shadow:'#3a4941',woodline:'#746146',dark:'#344c44'};
export function quarterMaterials(kit){return Object.fromEntries(Object.entries(QUARTER_COLORS).map(([k,color])=>[k,kit.mat({color,flat:false,line:.55,hatch:.15,detail:'none',weathered:k==='stone'?.13:.04,shade:.18,shadeHue:.75})]));}
export function terraceHouse(kit,M,o){dwelling(kit,M,{...o,y:o.y??0,spire:o.roof==='spire'});opening(kit,M,{x:o.x-.3,y:(o.y??0)+.08,z:o.z+(o.d??7)/2+.08,w:.95,h:2.6});}
export function quarterArch(kit,M,{x,y,z,w=6,h=7,depth=1.5,color='stone'}){
 const sh=new THREE.Shape(),r=w/2;sh.moveTo(-r-1,0);sh.lineTo(-r-1,h-r);sh.absarc(0,h-r,r+1,Math.PI,0,true);sh.lineTo(r+1,0);sh.lineTo(r,0);sh.lineTo(r,h-r);sh.absarc(0,h-r,r,0,Math.PI,false);sh.lineTo(-r,0);sh.closePath();
 kit.add(M[color],new THREE.ExtrudeGeometry(sh,{depth,bevelEnabled:true,bevelSize:.18,bevelThickness:.18,bevelSegments:3,curveSegments:28}).translate(x,y,z-depth/2));
}

function paintedQuarter(kit,M,ground,glassMat,stairs){
 const q=QUARTER,base=Math.max(...[-30,0,30].flatMap(dx=>[-30,0,30].map(dz=>ground.heightAt(q.x+dx,q.z+dz))))+.12;
 const T=[{x:0,z:0,rx:30,rz:29,y:0},{x:1,z:-4,rx:24,rz:22,y:5},{x:5,z:-9,rx:16,rz:15,y:10},{x:9,z:-13,rx:9,rz:9,y:16}];
 for(const [i,t] of T.entries())terrace(kit,M.stone,{x:q.x+t.x,z:q.z+t.z,y:base-3,h:t.y+3,rx:t.rx,rz:t.rz,seed:i});
 const p=(x,y,z)=>[q.x+x,base+y,q.z+z];
 // Each ascent follows the outside of the next terrace; the inner retaining wall
 // is the same solid geometry as its floor. No elevated boxes or fake stairways.
 const routes=[
  {t:T[1],a0:Math.PI/2,a1:Math.PI*.95,y0:0,y1:5},
  {t:T[2],a0:Math.PI*.56,a1:-Math.PI*.08,y0:5,y1:10},
  {t:T[3],a0:Math.PI,a1:Math.PI*.37,y0:10,y1:16},
 ];
 const landings=[];
 for(const {t,a0,a1,y0,y1} of routes){
  const pts=arcPoints(q.x+t.x,q.z+t.z,t.rx+1.95,t.rz+1.95,a0,a1,base+y0,base+y1,24);
  windingStair(kit,M,stairs,pts,{w:3.4,inner:a1<a0,outer:a1>a0,rail:.85,thin:y1===16});
  const a=pts.at(-1),end=[q.x+t.x+Math.cos(a1)*(t.rx-1.4),base+y1,q.z+t.z+Math.sin(a1)*(t.rz-1.4)];
  // A broad stone landing joins the stair's top to the terrace itself.
  const cx=(a[0]+end[0])/2,cz=(a[2]+end[2])/2;terrace(kit,M.stone,{x:cx,z:cz,y:base+y1-.5,h:.5,rx:2.5,rz:2.5});landings.push([a,end]);
 }
 const approach=[q.x,ground.heightAt(q.x,q.z+31),q.z+31];
 const approachTop=p(0,0,28);
 // Parapets grow out of the upper rings and become the houses' front walls.
 for(const [t,a0,a1] of [[T[1],-.08,.38*Math.PI],[T[2],.58*Math.PI,.9*Math.PI],[T[3],-.5*Math.PI,.24*Math.PI]])
  ribbonWall(kit,M.stone,arcPoints(q.x+t.x,q.z+t.z,t.rx-.4,t.rz-.4,a0,a1,base+t.y,base+t.y,20),{height:1.4,width:.8});
 const houses=[
  [11,25,0,8,6,4.7,'stone'],[23,7,0,8,8,7,'stone'],
  [5,14,5,9,7,6.8,'blue'],[-15,-13,5,7,8,9,'stone'],[-8,-23,5,8,7,13,'stone'],
  [5,3,10,6,6,6,'blue'],[-10,-15,5,6,7,17,'stone'],[9,-13,16,7.4,7.4,13.5,'coral'],
 ];
 for(const [i,[x,z,y,w,d,h,color]] of houses.entries()){
  dwelling(kit,M,{x:q.x+x,z:q.z+z,y:base+y,w,d,h,color,seed:i,round:color==='coral',spire:i===5||i===6});
  opening(kit,M,{x:q.x+x-w*.1,y:base+y+.1,z:q.z+z+d*.475+.06,w:color==='blue'?1.05:.86,h:2.7});
  if(h>9)opening(kit,M,{x:q.x+x+.6,y:base+y+h*.65,z:q.z+z+d*.465+.06,w:.62,h:1.4,window:true});
 }
 // Narrow painted doors sit in the retaining walls, at human scale.
 ellipseOpenings(kit,M,{x:q.x+1,z:q.z-4,y:base,rx:24,rz:22,angles:[.18,.43,.67,1.1,1.33],h:2.8,seed:-1});
 ellipseOpenings(kit,M,{x:q.x+5,z:q.z-9,y:base+5,rx:16,rz:15,angles:[1.8,2.1,2.45],h:2.8,seed:-1});
 // The gate belongs to a low dwelling and a walk above it, on the left edge.
 quarterArch(kit,M,{x:q.x-26,y:base,z:q.z+13,w:6,h:8,depth:3});
 dwelling(kit,M,{x:q.x-30,z:q.z+11,y:base,w:4,d:7,h:9,seed:4});
 dwelling(kit,M,{x:q.x-22,z:q.z+12,y:base,w:3,d:6,h:3.5,seed:6});
 for(const [i,[x,y,z,h]] of [[-7,0,18,3],[11,0,18,2.8],[21,0,10,3.4],[-9,5,12,3.7],[-13,5,-13,4],[2,10,5,2.8],[-27,0,15,3.5]].entries())wallGrowth(kit,{x:q.x+x,y:base+y,z:q.z+z,h,seed:200+i});
 const journey=[[approachTop,p(5,0,24)],[p(5,0,24),p(5,0,20)],[p(5,0,20),stairs[0].from],[landings[0][1],stairs[1].from],[landings[1][1],p(18,10,-2)],[p(18,10,-2),p(2,10,-2)],[p(2,10,-2),p(-5.3,10,-5)],[p(-5.3,10,-5),p(-5.3,10,-18)],[p(-5.3,10,-18),p(-1.95,10,-17)],[p(-1.95,10,-17),stairs[2].from]];
 // The plate's hill is crowded: a ring of small white houses stands on each terrace's rim, wherever no
 // stair, landing or walk passes, so the curved walls rise as a dense hillside of rooms.
 const walkSamples=[];
 const seg=(a,b,n=8)=>{for(let k=0;k<=n;k++)walkSamples.push(a.map((v,i)=>v+(b[i]-v)*k/n));};
 for(const s of stairs)for(let i=1;i<s.via.length;i++)seg(s.via[i-1],s.via[i],4);
 for(const [a,b] of [...landings,...journey,[approachTop,p(5,0,24)],[approach,approachTop]])seg(a,b);
 const blocked=(x,y,z,r,h)=>walkSamples.some(([sx,sy,sz])=>Math.hypot(x-sx,z-sz)<r+2.4&&sy>y-1.2&&sy<y+h+2.5);
 const HM={...M,door:M.ochre,window:M.ochre};
 // (ti -1: a ring on the sand round the hill's foot)
 for(const [ti,inset,size,step] of [[-1,-4,5,6.4],[0,3.2,4.6,6.2],[1,3.4,5.6,6.6],[2,3.2,5,6.4]]){
  const t=ti<0?{...T[0],y:-.6}:T[ti],next=T[ti+1],rx=t.rx-inset,rz=t.rz-inset,n=Math.floor(Math.PI*(rx+rz)/step);
  for(let i=0;i<n;i++){
   const a=(i+.5)/n*Math.PI*2+ti*.4,x=q.x+t.x+Math.cos(a)*rx,z=q.z+t.z+Math.sin(a)*rz;
   const w=size*(.8+.4*((i*37+ti*11)%7)/7),d=size*.9,h=ti<0?3:3.2+((i*53+ti*7)%9)*.55+(ti===2?1.5:0);
   // (inside the next ring: that is the next terrace's wall, not this one's rim)
   if(next&&((x-q.x-next.x)/(next.rx+2))**2+((z-q.z-next.z)/(next.rz+2))**2<1)continue;
   if(ti<0&&i%3)continue;   // (the foot: a house here and there, low, so the terraces show stepping up behind)
   if(blocked(x,base+t.y,z,size*.6,h))continue;
   cottage(kit,HM,{x,y:base+t.y,z,w,d,h,yaw:Math.atan2(x-q.x-t.x,z-q.z-t.z),seed:400+ti*50+i,spire:(i*7+ti)%13===4,windows:h>5?2:1});
  }
 }
 // The selected village is a tall hillside, not a broad plaza. Tighten its
 // horizontal scale while preserving human-width stairs and step height.
 const transform=new THREE.Matrix4().makeTranslation(q.x,base,q.z).multiply(new THREE.Matrix4().makeScale(1,1.4,1)).multiply(new THREE.Matrix4().makeTranslation(-q.x,-base,-q.z));
 for(const [g] of kit.pieces)g.applyMatrix4(transform);
 const positions=new Set([...stairs.flatMap(s=>[s.from,s.to,...s.via]),...landings.flat(),...journey.flat()]);
 for(const p of positions){const v=new THREE.Vector3(...p).applyMatrix4(transform);p.splice(0,3,...v.toArray());}
 windingStair(kit,M,stairs,[approach,approachTop],{w:5.6,inner:false,outer:false});
 // Thin overlapping glass folds make the settlement part of a landscape, with
 // sky visible through the curled ribbons, as in the selected stair-quarter plate.
 glassFold(kit,glassMat,[p(-36,-3,-17),p(-36,24,-28),p(-24,45,-36),p(0,45,-39),p(25,25,-36),p(32,-3,-27)],{width:17,seed:.3,thick:1.2});
 // (the west side leans on the giants' cliff: no ribbon there)
 // Leave the existing slalom's rising-air column at (-60,-130) open down to the sand.
 glassFold(kit,glassMat,[p(52,-3,-28),p(54,16,-10),p(54,20,9),p(51,9,25),p(48,-3,31)],{width:11,seed:3.1,thick:1});
 // Nearer ribbons curl round the hill's front corners, so the green waves frame it as in the plate.
 glassFold(kit,glassMat,[p(34,-3,60),p(40,15,47),p(50,24,30),p(58,12,18),p(62,-3,10)],{width:15,seed:4.2,thick:1.1});
 glassFold(kit,glassMat,[p(-26,-3,58),p(-36,17,44),p(-46,22,24),p(-50,-3,6)],{width:14,seed:5.3,thick:1.1});
 glassFold(kit,glassMat,[p(-20,-3,-44),p(-6,30,-50),p(18,52,-52),p(40,30,-46),p(48,-3,-40)],{width:20,seed:6.1,thick:1.3});
 return {base,landings,entry:approach,journey};
}

function cleft(kit,M,ground,glassMat,stairs){
 const b=CLEFT,base=ground.heightAt(b.x,b.z),glass=glassBatch(kit),ridges=[];
 const cleftGlass=kit.mat(glassOptions({shadeFlat:.2,glow:.02,line:.35,duneGlass:{mint:'#7baf7b',lime:'#b6ce88',rim:.26,band:[.72,1.15]}}));
 // The larger lobed cleft stands on open sand southwest of the landing, clear of the original course and camps.
 for(const [side,path] of [[-1,[[b.x-16,b.z+35],[b.x-20,b.z+5],[b.x-18,b.z-35]]],[1,[[b.x+17.5,b.z-35],[b.x+17.5,b.z],[b.x+18,b.z+34]]]]){
  const r=glassRidge({H:(x,z)=>ground.heightAt(x,z),path,height:side<0?60:64,depth:side<0?14:23,profile:'cliff',ends:10,seed:300+side,step:.65,rows:120,folds:{width:12,amp:.3,lean:.07,crest:.07}});cellularRidge(r,{seed:310+side,size:11,depth:4.5});
glass.add(cleftGlass,r.geo);ridges.push(r);
 }
 const vault=glassRidge({H:(x,z)=>ground.heightAt(x,z),path:[[b.x-26,b.z-30],[b.x-3,b.z-37],[b.x+25,b.z-31]],height:74,depth:22,profile:'wave',ends:7,step:.65,rows:120,seed:306,passages:[{at:[b.x+1,b.z-36],w:26,h:46}],folds:{width:7,amp:1.7,lean:.2,crest:.05}});cellularRidge(vault,{seed:306,size:11,depth:4.2});glass.add(cleftGlass,vault.geo);for(const p of vault.passages){glass.add(cleftGlass,glassPassage(p,{color:'#5e8d62'}));cellularVault(glass,cleftGlass,p,41,1.5);}ridges.push(vault);const walls=glass.finish();kit.group.updateMatrixWorld(true);
 const lower=[b.x+10,ground.heightAt(b.x+10,b.z+28)+.08,b.z+28],middle=[b.x+11.5,base+8,b.z+3],upper=[b.x+11.5,base+19,b.z-25];
 windingStair(kit,{stone:M.red,step:M.red},stairs,[lower,[b.x+11,base+4,b.z+16],middle],{w:3.2,inner:false,outer:true,rail:.45,thin:true,thickness:1.4});
 terrace(kit,M.red,{x:middle[0],z:middle[2]-1,y:base+7.55,h:.45,rx:2.3,rz:3});
 windingStair(kit,{stone:M.red,step:M.red},stairs,[[middle[0],middle[1],middle[2]-2],[b.x+11.5,base+13,b.z-12],upper],{w:3.1,inner:false,outer:true,rail:.45,thin:true,thickness:1.4});
 // the plate's pale floor between the green walls
 paleFloor(kit,floorMaterial(kit,['#ece6c8','#e4dcbb','#f0ead0']),ground,{x:b.x,z:b.z+2,w:30,d:76,round:.75});
 // fallen glass and stone along the left wall, off the lane and the stair's side
 rubble(kit,kit.mat({color:'#d9d4b4',line:.5,hatch:.2,shade:.3,shadeHue:.6}),ground,{x:b.x-10,z:b.z+4,r:26,n:46,seed:720,size:1.1,clear:(x,z)=>x>b.x-5||Math.abs(z-b.z)>40});
 terrace(kit,M.red,{x:upper[0],z:upper[2]-1,y:upper[1]-.5,h:.5,rx:2.2,rz:2.5});
 // Recesses and landings touch the actual cliff surface, including its folds.
 const doorM={...M,gold:kit.mat({color:'#ffc45c',glow:.9,line:.3,hatch:0,shade:.1})};
 for(const at of [middle,upper]) {
  const ray=new THREE.Raycaster(new THREE.Vector3(at[0],at[1]+1.4,at[2]),new THREE.Vector3(1,0,0),0,22),hit=ray.intersectObjects(walls,false)[0];
  if(!hit)continue;const x=hit.point.x-.08;
  box(kit,M.red,(at[0]+x)/2,at[1]-.3,at[2],x-at[0]+.3,.6,2.6);
  opening(kit,doorM,{x,y:at[1],z:at[2],yaw:-Math.PI/2,w:1.35,h:4.6,paint:'gold'});
  opening(kit,doorM,{x:x+.06,y:at[1]+6.4,z:at[2],yaw:-Math.PI/2,w:.8,h:1.8,window:true,paint:'gold'});
 }
 return {base,ridges,landings:[[middle,[middle[0],middle[1],middle[2]-2]]],sight:[b.x,base+.2,b.z+15]};
}

/**
 * The half-buried court (half-buried-courtyard.jpeg): cream rock with dwellings carved into it, piled
 * against the green glass cave on both sides of a sandy court; a dark plum cave mouth in the left
 * mass, a tall blue door beside it, broad stairs climbing between the dwellings to the back.
 */
function courtyard(kit,M,ground,glassMat,stairs){
 const R=massMaterials(kit,{...M,
  stone:kit.mat({color:'#e9dfc3',line:.6,hatch:.2,weathered:.6,detail:'built',detailDensity:.5,patches:.5,shade:.1,shadeHue:.9}),
  trim:kit.mat({color:'#d8ccad',line:.55,hatch:.2,weathered:.5,detail:'built',shade:.1,shadeHue:.9}),
  gold:kit.mat({color:'#d9a54a',line:.4,hatch:.1,shade:.15,shadeHue:.8}),
  red:kit.mat({color:'#b9543c',line:.4,hatch:.1,shade:.15,shadeHue:.8}),
  blue:kit.mat({color:'#2f5d9a',line:.45,hatch:.12,shade:.15,shadeHue:.8}),
 },{hole:'#3a3a30',lit:'#efb65a',rock:{color:'#ece2c6',line:.6,hatch:.2,weathered:.5,detail:'built',detailDensity:.35,patches:.5,shade:.12,shadeHue:.85}});
 const c=COURT,base=ground.heightAt(c.x,c.z),p=(x,y,z)=>[c.x+x,base+y,c.z+z];
 // the court's floor, warm pale sand (not solid: the traveller walks on the sand under it)
 const sand=floorMaterial(kit,['#f1dfb6','#ead3a4','#f4e6c4']);
 paleFloor(kit,sand,ground,{x:c.x+4,z:c.z-6,w:84,d:74,round:.5});
 // the raised floor and its two stairs, the back terrace and its stair round the right
 terrace(kit,R.trim,{x:c.x+8,z:c.z-16,y:base-1,h:4,rx:14,rz:12});
 const east=arcPoints(c.x+8,c.z-16,15.9,13.9,Math.PI*.5,0,base,base+3,18);
 windingStair(kit,R,stairs,east,{w:3.3,outer:false});
 const west=[[c.x-3,base,c.z+5],[c.x-3,base+1.5,c.z-4],[c.x-3,base+3,c.z-12]];windingStair(kit,R,stairs,west,{w:4,outer:false});
 terrace(kit,R.trim,{x:c.x+12,z:c.z-59,y:base-2,h:14,rx:27,rz:22});
 windingStair(kit,R,stairs,[p(23.9,3,-16),p(28,6,-25),p(30,12,-33),p(30,12,-46),p(22,12,-47)],{w:4.2,thin:true,thickness:1,outer:false});
 // a broad stair straight up the middle to the back terrace, as the plate's
 windingStair(kit,R,stairs,[p(1,3,-25),p(1,7.5,-32),p(1,12,-40)],{w:7,inner:false,outer:false});
 // the left mass: the dark cave mouth (a plum-dark recess in a rock arch), rock piled round and over it
 quarterArch(kit,{...R,stone:R.rock},{x:c.x-14.3,y:base,z:c.z-10,w:8.4,h:24,depth:8});
 const recess=kit.mat({color:'#331d2b',line:.2,hatch:.25,shade:.05,shadeHue:1});
 box(kit,recess,c.x-14.3,base+11.5,c.z-20,8.6,23,1.8);
 for(const [x,y,z,sx,sy,sz,seed] of [[-14.3,31,-12,8,7,7,1],[-25,26,-13,6,15,7,2],[-19,38,-16,8,9,8,4],[-9,30,-14,5,7,6,5],[-27,10,-4,5,10,6,6],[-31,30,-14,8,20,9,7]])lump(kit,R.rock,c.x+x,base+y,c.z+z,sx,sy,sz,600+seed,{detail:2});
 for(const [x,y,z,w,d,h,yaw,seed,door] of [[-27,0,-10,9,10,17,0,1,'hole'],[-35,0,2,8,9,11,.4,2,'red'],[-26,17,-14,7,8,9,0,3,'hole'],[-38,0,-18,10,12,30,.2,4,'gold']])rockDwelling(kit,R,{x:c.x+x,y:base+y,z:c.z+z,w,d,h,yaw,seed:610+seed,door,windows:4});
 // the tall blue door, in a block of rock between the cave mouth and the middle stair
 box(kit,R.rock,c.x-7.3,base+8,c.z-9.5,4.6,16,9);
 lump(kit,R.rock,c.x-7.3,base+17,c.z-10,3,4,5,620,{detail:2});
 hole(kit,R.blue,c.x-7.3,base,c.z-4.95,0,2.4,8,{arch:false});
 // the right mass: dwellings in tiers, doors at their feet, stairs between
 for(const [x,y,z,w,d,h,yaw,seed,door] of [[41,0,-10,11,10,18,-.15,5,'red'],[44,0,-26,10,12,28,-.1,6,'gold'],[40,18,-8,8,7,10,-.15,7,'hole'],[38,0,-40,10,10,36,0,8,'hole'],[17,0,-36,9,8,16,0,9,'gold'],[50,0,2,8,10,12,-.3,10,'hole'],[45,28,-26,8,9,9,-.1,11,'hole']])rockDwelling(kit,R,{x:c.x+x,y:base+y,z:c.z+z,w,d,h,yaw,seed:630+seed,door,windows:4});
 for(const [x,y,z,sx,sy,sz,seed] of [[45,40,-30,7,8,7,1],[36,22,-14,5,6,5,2],[52,20,-14,6,18,7,3],[34,36,-44,7,9,7,4]])lump(kit,R.rock,c.x+x,base+y,c.z+z,sx,sy,sz,650+seed,{detail:2});
 // the back: dwellings stacked on the raised terrace up into the cave
 for(const [x,y,z,w,d,h,seed,door] of [[-8,12,-48,11,8,14,12,'red'],[7,12,-50,9,8,20,13,'hole'],[-20,0,-50,10,10,36,14,'gold'],[0,26,-60,14,10,14,15,'hole'],[18,12,-64,12,12,30,16,'hole'],[-10,12,-70,12,10,34,17,'hole'],[33,12,-58,8,10,18,18,'red'],[4,40,-68,10,10,12,19,'hole']])rockDwelling(kit,R,{x:c.x+x,y:base+y,z:c.z+z,w,d,h,seed:660+seed,door,windows:5});
 for(const [x,y,z,sx,sy,sz,seed] of [[-14,46,-62,8,8,8,1],[22,44,-66,9,7,8,2],[6,54,-70,7,6,7,3],[-28,34,-50,6,10,7,4]])lump(kit,R.rock,c.x+x,base+y,c.z+z,sx,sy,sz,680+seed,{detail:2});
 rubble(kit,R.rock,ground,{x:c.x,z:c.z-2,r:30,n:40,seed:690,size:1.1,clear:(x,z)=>Math.abs(x-(c.x-3))<4||Math.abs(x-(c.x-14.3))<5&&z>c.z-16||Math.abs(x-c.x)<4&&z>c.z||Math.hypot(x-(c.x+8),z-(c.z-16))<17});
 for(const [i,[x,z]] of [[-21,6],[-11,-4],[14,6],[30,-4],[-30,2],[26,8]].entries())wallGrowth(kit,{x:c.x+x,y:base,z:c.z+z,h:2.4+i%3,seed:300+i});
 // the cave: deep emerald glass, closing over the court
 const courtGlass=kit.mat(glassOptions({shadeFlat:.3,glow:.08,line:.4,duneGlass:{mint:'#4f9a72',lime:'#9fd8a6',rim:.35,band:[.5,.95]}}));
 const cave=glassCave(kit,courtGlass,{x:c.x,y:base,z:c.z,scale:[1.8,2.2,2.3]});
 return {base,cave,sight:p(0,.2,10)};
}

export function buildGlassQuarter(scene,ground,glassMat){
 const group=new THREE.Group();group.name='Glass Dunes — the painted terraces, red cleft and buried court';scene.add(group);
 const stairs=[];
 // One kit (one set of merged meshes) per place, so each is culled on its own when out of view.
  // A turned place (q.yaw) is built in its own frame about its anchor, on the ground as it lies there once turned,
 // then its group is turned into place, and the points it returns with it.
 const area=(name,seed,fn,q=null)=>{
  const g=new THREE.Group();g.name=name;group.add(g);
  const turn=q?.yaw?placed(q):null;
  const gr=turn?{heightAt:(x,z)=>{const [wx,,wz]=turn(x,0,z);return ground.heightAt(wx,wz);},baseAt:(x,z,r)=>{const [wx,,wz]=turn(x,0,z);return ground.baseAt?ground.baseAt(wx,wz,r):ground.heightAt(wx,wz);}}:ground;
  const kit=new RoomKit({group:g,ground:gr,centre:new THREE.Vector3(),seed});
  const before=stairs.length,out=fn(kit,quarterMaterials(kit),gr);
  if(turn){
   g.rotation.y=q.yaw;const [ox,,oz]=turn(0,0,0);g.position.set(ox,0,oz);g.updateMatrixWorld(true);
   const move=(p)=>{if(Array.isArray(p)&&typeof p[0]==='number'&&p.length===3)p.splice(0,3,...turn(...p));};
   for(const st of stairs.slice(before))for(const p of new Set([st.from,st.to,...st.via]))move(p);
   for(const v of Object.values(out))if(Array.isArray(v)&&typeof v[0]==='number')move(v);
  }
  kit.finish();for(const m of kit.noShadow)m.userData.castShadow=false;return out;
 };
 const quarter=area('the painted quarter',184,(kit,M)=>withoutDrifts(()=>paintedQuarter(kit,M,ground,glassMat,stairs)));
 const b=area('the vermilion cleft',185,(kit,M)=>cleft(kit,M,ground,glassMat,stairs));
 const c=area('the half-buried court',186,(kit,M,gr)=>withoutDrifts(()=>courtyard(kit,M,gr,glassMat,stairs)),COURT);
 return {group,stairs,cave:c.cave,base:quarter.base,ridges:b.ridges,landings:[...quarter.landings,...b.landings],entry:quarter.entry,journey:quarter.journey,
 sights:[{name:'the painted stair quarter',at:[QUARTER.x,quarter.base+.2,QUARTER.z+24]},{name:'the vermilion stair',at:b.sight},{name:'the half-buried court',at:c.sight}],
 // (the court: its footprint in its own frame, x ±75, z from 145 behind the anchor to 38 before it)
 avoid:(x,z,r=0)=>{if(Math.abs(x-QUARTER.x)<66+r&&Math.abs(z-QUARTER.z)<66+r||Math.abs(x-CLEFT.x)<43+r&&Math.abs(z-CLEFT.z)<45+r)return true;const [lx,,lz]=placed({...COURT,yaw:-COURT.yaw})(x,0,z);return Math.abs(lx-COURT.x)<75+r&&lz>COURT.z-145-r&&lz<COURT.z+38+r;}};
}
