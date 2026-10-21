// Furnished rooms laid out in physical metres; furniture is never scaled with the hull.
import * as THREE from 'three';
import { ROOMS, STAIRS, CARAVAN_SCALE, AUTHORED_ENTRY, DECK, COCKPIT_DECK, WALL_IN, HATCH, HATCH_A, SALOON_WINDOW, inRooms, cockpitHalf } from './caravan-layout.js';
import { familyDrawing, motherNote, homePhoto, starChart } from './art.js';
import { makeMaterial } from '../materials.js';
export { ROOMS, inRooms, cockpitHalf };
export const CONSOLE_R = 1.5, TABLE_R = 1.6;
export const TABLE = { x: 2.1, z: -5, r: .225, h: .5, planetR: .5, planetY: 1.1, compact: true };
export const cockpitZ = z => z - 10.1;
export const SEATS = { x: 1.3, z: -18.25 };
const MESSAGE = { x: 3.55, z: 1.1 };
const BUNK = { x: -2.2, z: 2 };
const V = (x,y,z) => new THREE.Vector3(x,y,z);
export function buildCaravanInterior(batch, group) {
  const deco = new THREE.Group(), props = new THREE.Group();
  deco.name='caravan-room-details'; props.name='caravan-personal-belongings';
  deco.userData.noCollide = props.userData.noCollide = true; group.add(deco,props);
  const box = (mat,x,y,z,w,h,d) => batch.add(mat,new THREE.BoxGeometry(w,h,d).translate(x,y+h/2,z));
  const cyl = (mat,x,y,z,r,h) => batch.add(mat,new THREE.CylinderGeometry(r,r,h,20).translate(x,y+h/2,z));
  const pipe = (mat,a,b,r=.035) => { const d=b.clone().sub(a); batch.add(mat,new THREE.CylinderGeometry(r,r,d.length(),8).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0,1,0),d.normalize())).translate(...a.clone().add(b).multiplyScalar(.5).toArray())); };
  const rounded=(mat,x,y,z,w,h,d)=>batch.add(mat,new THREE.SphereGeometry(1,16,10).scale(w/2,h/2,d/2).translate(x,y+h/2,z));
  const dial=(x,y,z,r=.13)=>{
    batch.add('metal',new THREE.CylinderGeometry(r,r,.045,16).rotateX(Math.PI/2).translate(x,y,z));
    batch.add('cream',new THREE.CircleGeometry(r*.8,16).translate(x,y,z+.027));
    pipe('dark',V(x,y,z+.032),V(x+r*.45,y+r*.35,z+.032),.012);
  };
  const block = (x,y,z,w,d) => box('collider',x,y,z,w,1.12,d);
  const cabinet=(x,y,z,w,h,d)=>{
    box('locker',x,y,z,w,h,d); for(let i=0;i<Math.ceil(h/.38);i++){
      box('trim',x,y+.15+i*.38,z-d/2-.025,w-.08,.025,.025);
      box('metal',x,y+.22+i*.38,z-d/2-.055,.22,.035,.045);
    }
  };
  const chair=(x,y,z,mat='cushion')=>{
    box(mat,x,y+.42,z,.62,.12,.64);box(mat,x,y+.48,z+.27,.62,.68,.1);
    for(const dx of [-.23,.23])for(const dz of [-.23,.23])pipe('metal',V(x+dx,y,z+dz),V(x+dx,y+.43,z+dz));
    block(x,y,z,.7,.7);
  };
  const books=(x,y,z,n=7)=>{for(let i=0;i<n;i++)box(i%3===0?'cushion':i%3===1?'teal':'cream',x+i*.095,y,z,.075,.22+(i%3)*.045,.18);};
  const picture=(texture,x,y,z,w,h,reverse=false)=>{
    if(!texture)return;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),makeMaterial({color:'#ffffff',map:texture,glow:.18}));mesh.position.set(x,y,z);if(reverse)mesh.rotation.y=Math.PI;props.add(mesh);
    box('wood',x,y-h/2-.04,z+(reverse?.025:-.025),w+.1,h+.08,.045);
  };
  // Separate flat decks and an actual stair run: no invisible elevator or camera-only height change.
  for(const [name,r] of Object.entries(ROOMS)) {
    const left=r.left??r.half, right=r.right??r.half, cx=(right-left)/2, width=left+right;
    box('floor',cx,r.floor-.18,(r.z0+r.z1)/2,width,.18,r.z1-r.z0);
    if(name==='cockpit') {
      // A flat rectangle at this height would pierce the curved nose. Follow the actual forecabin section.
      const y=r.ceiling/CARAVAN_SCALE+AUTHORED_ENTRY.y+.8;
      const section=Math.pow(1-Math.pow(Math.abs((y-8.3)/5),2.6),1/2.6);
      const half=(5.5*section-.08)*CARAVAN_SCALE, arc=[];
      for(let i=0;i<=64;i++) {
        const a=-Math.PI/2+Math.PI*i/64;
        arc.push(new THREE.Vector2(-half*Math.sin(a),(-13.8-(6.2*section-.08)*Math.cos(a)-AUTHORED_ENTRY.x)*CARAVAN_SCALE));
      }
      arc.push(new THREE.Vector2(-half,r.z1),new THREE.Vector2(half,r.z1));
      batch.add('ceiling',new THREE.ShapeGeometry(new THREE.Shape(arc)).rotateX(Math.PI/2).translate(0,r.ceiling,0));
    } else if(name==='main') {
      // The stairwell opens into the high forecabin rather than through a low ceiling slab.
      box('ceiling',cx,r.ceiling,(STAIRS.z1+r.z1)/2,width,.18,r.z1-STAIRS.z1);
      const edge=STAIRS.x+STAIRS.width/2+.25;
      box('ceiling',(edge+right)/2,r.ceiling,(r.z0+STAIRS.z1)/2,right-edge,.18,STAIRS.z1-r.z0);
    } else box('ceiling',cx,r.ceiling,(r.z0+r.z1)/2,width,.18,r.z1-r.z0);
    for(const side of [-1,1]) {
      if(name==='cockpit')continue; // the real curved glazed shell encloses this room
      if(name==='main'&&side<0) {
        for(const [a,b] of [[r.z0,HATCH.z0],[HATCH.z1,r.z1]])box('wall',-left,0,(a+b)/2,.2,r.ceiling,b-a);
        box('wall',-left,HATCH.y1,0,.2,r.ceiling-HATCH.y1,HATCH.z1-HATCH.z0);
      } else if(name==='main') {
        const w=SALOON_WINDOW;
        for(const [a,b] of [[r.z0,w.z0],[w.z1,r.z1]])box('wall',right,0,(a+b)/2,.2,r.ceiling,b-a);
        box('wall',right,0,(w.z0+w.z1)/2,.2,w.y0,w.z1-w.z0);
        box('wall',right,w.y1,(w.z0+w.z1)/2,.2,r.ceiling-w.y1,w.z1-w.z0);
        for(const z of [w.z0,w.z1])box('trim',right, w.y0,z,.4,w.y1-w.y0,.12);
        for(const y of [w.y0,w.y1])box('trim',right,y,(w.z0+w.z1)/2,.4,.12,w.z1-w.z0);
      } else box('wall',side<0?-left:right,r.floor,(r.z0+r.z1)/2,.2,r.ceiling-r.floor,r.z1-r.z0);
    }
  }
  // Enclosed tall stairwell: its walls meet the upper ceiling, concealing the shell's service cavities.
  const shaftHalf=STAIRS.width/2+.25, shaftZ=(STAIRS.z0+STAIRS.z1)/2;
  for(const side of [-1,1])box('wall',STAIRS.x+side*shaftHalf,ROOMS.main.ceiling,shaftZ,.10,ROOMS.cockpit.ceiling-ROOMS.main.ceiling,STAIRS.z1-STAIRS.z0);
  box('ceiling',STAIRS.x,ROOMS.cockpit.ceiling,shaftZ,shaftHalf*2,.12,STAIRS.z1-STAIRS.z0);
  box('wall',STAIRS.x,ROOMS.main.ceiling,STAIRS.z1,shaftHalf*2,ROOMS.cockpit.ceiling-ROOMS.main.ceiling,.10);
  // The upper deck ends at the top riser, leaving the stairwell open overhead.
  const rise=STAIRS.rise/STAIRS.steps, run=(STAIRS.z1-STAIRS.z0)/STAIRS.steps;
  for(let i=0;i<STAIRS.steps;i++) {
    const z=STAIRS.z1-(i+.5)*run;
    box('floor',STAIRS.x,0,z,STAIRS.width,(i+1)*rise,run+.005);
    box('trim',STAIRS.x,(i+1)*rise-.025,z+run/2-.035,STAIRS.width,.025,.07);
  }
  for(const side of [-1,1])pipe('metal',V(STAIRS.x+side*(STAIRS.width/2+.08),1,STAIRS.z1),V(STAIRS.x+side*(STAIRS.width/2+.08),COCKPIT_DECK+1,STAIRS.z0),.045);
  // Close the previously open service cavities around the raised cockpit and stair landing.
  const stairL=STAIRS.x-STAIRS.width/2, stairR=STAIRS.x+STAIRS.width/2;
  for(const side of [-1,1]) {
    const edge=side<0?stairL:stairR, contour=[new THREE.Vector2(edge,COCKPIT_DECK)];
    for(let i=0;i<=24;i++) {
      const y=COCKPIT_DECK+(ROOMS.cockpit.ceiling-COCKPIT_DECK)*i/24;
      const section=Math.pow(1-Math.pow(Math.abs((y/CARAVAN_SCALE+AUTHORED_ENTRY.y+.8-8.3)/5),2.6),1/2.6);
      contour.push(new THREE.Vector2(side*(5.5*section-.1)*CARAVAN_SCALE,y));
    }
    contour.push(new THREE.Vector2(edge,ROOMS.cockpit.ceiling));
    batch.add('wall',new THREE.ExtrudeGeometry(new THREE.Shape(contour),{depth:.22,bevelEnabled:false}).translate(0,0,ROOMS.cockpit.z1-.11));
  }
  // The lower room ends at the cockpit bulkhead, including underneath its raised floor.
  box('wall',(ROOMS.main.right-ROOMS.main.left)/2,0,ROOMS.main.z0,ROOMS.main.left+ROOMS.main.right,COCKPIT_DECK,.22);
  // Door openings leave room for both the traveller and the follow camera.
  for(const [prev,next] of [[ROOMS.main,ROOMS.cabin],[ROOMS.cabin,ROOMS.hold]]){
    const left=Math.max(prev.left??prev.half,next.half),right=Math.max(prev.right??prev.half,next.half),ceil=Math.max(prev.ceiling,next.ceiling),z=next.z0;
    for(const [lo,hi] of [[-left,-1.8],[1.8,right]])box('wall',(lo+hi)/2,0,z,hi-lo,ceil,.22);
    box('wall',0,3.9,z,3.6,ceil-3.9,.22);
  }
  box('wall',0,0,ROOMS.hold.z1,ROOMS.hold.half*2,ROOMS.hold.ceiling,.22);
  // A low crescent dash follows the panoramic window; instruments remain below the horizon.
  for(let i=0;i<11;i++) {
    const x=(i-5)*.54,z=-20.0+.12*x*x;
    box('teal',x,COCKPIT_DECK+.20,z,.57,.65,.72);
    box('cream',x,COCKPIT_DECK+.85,z,.58,.06,.78);
    box('panel',x,COCKPIT_DECK+.91,z-.16,.48,.33,.14);
    if(i%3===0)dial(x,COCKPIT_DECK+1.08,z-.07);
    else {
      box('dark',x,COCKPIT_DECK+.97,z-.075,.32,.22,.025);
      box('glowTeal',x,COCKPIT_DECK+1.02,z-.055,.22,.015,.012);
    }
    for(const dx of [-.12,.12])box(i%3?'btnB':'btnA',x+dx,COCKPIT_DECK+.92,z+.18,.07,.025,.08);
    box('metal',x,COCKPIT_DECK+.45,z+.38,.17,.025,.04);
  }
  for(const x of [-SEATS.x,SEATS.x]) {
    cyl('metal',x,COCKPIT_DECK,SEATS.z,.30,.08);
    cyl('metal',x,COCKPIT_DECK+.08,SEATS.z,.09,.34);
    rounded('cream',x,COCKPIT_DECK+.35,SEATS.z,.72,.18,.76);
    rounded('toy',x,COCKPIT_DECK+.43,SEATS.z,.63,.13,.66);
    rounded('cream',x,COCKPIT_DECK+.49,SEATS.z+.30,.72,.92,.20);
    rounded('toy',x,COCKPIT_DECK+.54,SEATS.z+.21,.62,.78,.16);
    for(const dx of [-.36,.36]) {
      pipe('metal',V(x+dx,COCKPIT_DECK+.42,SEATS.z+.22),V(x+dx,COCKPIT_DECK+.70,SEATS.z+.22));
      rounded('toy',x+dx,COCKPIT_DECK+.68,SEATS.z,.12,.10,.48);
    }
    block(x,COCKPIT_DECK,SEATS.z,.78,.82);
  }
  picture(familyDrawing(),2.3,COCKPIT_DECK+1.3,-19.22,.38,.29);
  cyl('cream',-2.4,COCKPIT_DECK+.92,-19.07,.08,.14);
  cyl('metal',-2.4,COCKPIT_DECK+.91,-19.07,.11,.03);
  pipe('metal',V(2.65,COCKPIT_DECK+.9,-19.1),V(2.65,COCKPIT_DECK+1.55,-19.1));
  rounded('lamp',2.65,COCKPIT_DECK+1.47,-19.1,.28,.13,.28);
  // Galley on the port wall: sink, hotplate, cups, kettle and storage.
  cabinet(4.6,0,-5.7,1.05,.9,3.1);
  box('cream',4.6,.9,-5.7,1.13,.07,3.2);
  // Coral drawer fronts face the aisle, with practical latches and a recessed sink.
  for(let i=0;i<4;i++) {
    const z=-6.85+i*.76;box('toy',4.055,.08,z,.045,.74,.69);
    box('metal',4.02,.65,z,.04,.035,.25);
  }
  box('dark',4.5,.974,-5.2,.55,.012,.52);box('metal',4.5,.98,-5.2,.42,.012,.39);
  box('cream',4.6,.98,-4.5,.48,.24,.32);box('metal',4.6,1.22,-4.5,.51,.025,.35);
  // Tools and small repair kit stay clipped to the wall, clear of the centre aisle.
  box('teal',5.12,1.25,-6.15,.06,.65,1.0);
  for(let i=0;i<3;i++) {
    const z=-6.48+i*.27;pipe('metal',V(5.06,1.38,z),V(5.06,1.73,z),.022);
    box('cream',5.03,1.42,z,.08,.05,.09);
  }
  box('blanket',4.04,.50,-4.75,.035,.35,.25);
  cyl('dark',4.6,.95,-6.5,.28,.025);cyl('metal',4.6,.98,-6.5,.19,.25);
  pipe('metal',V(4.9,1.0,-5.1),V(4.9,1.35,-5.1));pipe('metal',V(4.9,1.35,-5.1),V(4.6,1.35,-5.1));
  for(const z of [-5.4,-5.0])cyl('cream',4.2,.95,z,.09,.16);
  cabinet(4.75,2.1,-5.7,.7,.75,2.9);
  // Bunk faces the message console across the open main deck.
  const bx=BUNK.x,bz=BUNK.z;
  box('teal',bx,0,bz,1.35,.42,2.4);box('cream',bx,.42,bz,1.27,.16,2.32);
  rounded('toy',bx,.58,bz-.35,1.25,.14,1.55);rounded('cream',bx,.59,bz+.85,.85,.18,.42);block(bx,0,bz,1.4,2.5);
  picture(motherNote(),bx,1.8,bz-1.26,.42,.35);books(bx-.5,1.3,bz-1.35);box('wood',bx,1.24,bz-1.35,1.2,.06,.25);
  for(const z of [bz-.65,bz+.2,bz+.95]) {
    box('cream',bx+.69,.08,z,.025,.26,.64);box('metal',bx+.72,.22,z,.04,.025,.20);
  }
  pipe('metal',V(bx-.5,.85,bz+.9),V(bx-.5,1.55,bz+.9));rounded('lamp',bx-.5,1.48,bz+.9,.24,.12,.25);
  for(const dz of [-.15,.15])rounded('wood',bx+.98,.025,bz+dz,.18,.10,.32);
  box('rug',1.3,.012,1.1,3.4,.008,3.6);box('rugInner',1.3,.021,1.1,3.15,.006,3.35);
  // Navigation table is separate from the reachable message console, leaving the entry aisle clear.
  cyl('metal',TABLE.x,0,TABLE.z,.28,.06);
  cyl('cream',TABLE.x,.06,TABLE.z,.19,TABLE.h-.10);
  cyl('teal',TABLE.x,TABLE.h-.04,TABLE.z,TABLE.r,.04);
  cyl('glowTeal',TABLE.x,TABLE.h,TABLE.z,.13,.012);
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4,x=TABLE.x+Math.sin(a)*.20,z=TABLE.z+Math.cos(a)*.20;
    pipe('metal',V(x,.07,z),V(x,.45,z),.018);
  }
  const mx=MESSAGE.x,mz=MESSAGE.z;
  // Selected rounded wall viewer: its frame is BEHIND the projection, never across a face.
  // Mount on a slender stand at the side window so stars remain visible around it.
  box('teal',mx+.25,0,mz,.32,.89,1.05);
  box('cream',mx,.88,mz,.82,.09,1.25);
  const frameX=mx+.40,frameY=1.35;
  const frame=(mat,ry,rz,r)=>{
    for(let i=0;i<48;i++) {
      const a=i*Math.PI/24,b=(i+1)*Math.PI/24;
      pipe(mat,V(frameX,frameY+Math.sin(a)*ry,mz+Math.cos(a)*rz),V(frameX,frameY+Math.sin(b)*ry,mz+Math.cos(b)*rz),r);
    }
  };
  frame('toy',.40,.54,.065);frame('cream',.34,.48,.025);
  batch.add('dark',new THREE.CircleGeometry(1,48).scale(.48,.34,1).rotateY(-Math.PI/2).translate(frameX+.04,frameY,mz));
  for(const z of [mz-.53,mz+.53])pipe('metal',V(frameX,.94,z),V(frameX,1.18,z),.035);
  box('lamp',frameX-.06,1.80,mz,.12,.06,.26);
  for(let i=0;i<3;i++)cyl(i===0?'vmail':'metal',mx-.24,.98,mz-.35+i*.35,.065,.045);
  cyl('vmailHalo',mx-.24,.97,mz-.35,.11,.025);
  const projector=V(mx,1.03,mz);
  cyl('metal',projector.x,.97,projector.z,.14,.06);
  // Plumb's cradle and coats beside the entry, leaving the entire doorway unobstructed.
  box('wood',-2.7,1.18,-1.7,.65,.08,.55);cyl('metal',-2.7,1.26,-1.7,.22,.08);
  for(let i=0;i<3;i++){box('metal',-2.85,2.0,1.6+i*.45,.08,.08,.08);box('blanket',-2.75,1.2,1.6+i*.45,.15,.75,.28);}
  // Cabin: sofa, a proper table, two chairs and personal books, all secured in flight.
  box('wood',-3.5,0,7,1.1,.32,2.4);box('cushion',-3.5,.32,7,1.1,.25,2.4);box('cushion',-3.95,.55,7,.2,.65,2.4);block(-3.5,0,7,1.2,2.5);
  box('wood',1.5,.72,7.6,1.2,.09,1.6);for(const z of [7.0,8.2])pipe('metal',V(1.5,0,z),V(1.5,.72,z),.07);
  chair(1.5,0,8.9);cabinet(3.6,0,8.8,.8,1.3,1.25);books(3.15,1.3,8.55);
  picture(homePhoto(),-2.7,2,9.86,1,.65,true);
  // Hold: cargo and tools to either side; the path to the engine service door stays clear.
  for(const side of [-1,1])for(let i=0;i<3;i++){
    const x=side*3.05,z=12+i*1.25;
    box('crate',x,0,z,.95,.95,1.1);box('metal',x,.95,z,1,.045,.12);
    for(const dx of [-.35,.35])box('dark',x+dx,0,z,.05,.98,1.12);
  }
  box('metal',0,.12,15.99,1.6,2.5,.1);box('dark',0,1.3,15.92,.4,.08,.07);
  picture(starChart(),-2.5,2,3.86,.9,.65,true);
  const lamps=Object.entries(ROOMS).flatMap(([name,r])=>[.25,.75].map(t=>({name,p:V(name==='main'?2.7:0,r.ceiling-.45,r.z0+(r.z1-r.z0)*t),r:7})));
  for(const l of lamps){cyl('lamp',l.p.x,l.p.y,l.p.z,.18,.1);}
  const stand=V(-.8,0,-.15),listener=V(1.65,0,mz);
  const heading=Math.atan2(mx-stand.x,mz-stand.z);
  const points={
    wakeEye:V(bx,.9,bz+.8),wakeLook:V(mx,1.5,mz),wakeSit:V(bx,1.25,bz+.8),wakeRoom:V(mx,1.6,mz),bunkStand:stand,bunkStandHeading:heading,
    cockpit:listener,cockpitHeading:Math.PI/2,projector,
    seat:V(-SEATS.x,COCKPIT_DECK+.45,SEATS.z),table:V(TABLE.x,TABLE.planetY,TABLE.z),tableFoot:V(TABLE.x-1.2,0,TABLE.z),
    hatchIn:V(-WALL_IN+1.1,0,0),hatchHeading:HATCH_A,threshold:V(-3.25,0,0),aboard:V(-.9,0,.2),
    voicemail:V(mx-.24,1.025,mz-.35),dock:V(-2.7,1.55,-1.7),
  };
  return {deco,props,lamps,points,table:TABLE,screen:{centre:V(mx-.1,1.12,mz+.53),normal:V(-1,.15,0).normalize(),radius:.12}};
}
