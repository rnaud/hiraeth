// Furnished rooms laid out in physical metres; furniture is never scaled with the hull.
import * as THREE from 'three';
import { ROOMS, STAIRS, CARAVAN_SCALE, AUTHORED_ENTRY, DECK, COCKPIT_DECK, WALL_IN, HATCH, HATCH_A, inRooms, cockpitHalf } from './caravan-layout.js';
import { familyDrawing, motherNote, homePhoto, starChart } from './art.js';
import { makeMaterial } from '../materials.js';
export { ROOMS, inRooms, cockpitHalf };
export const CONSOLE_R = 1.5, TABLE_R = 1.6;
export const TABLE = { x: .35, z: 2.5, r: .58, h: .92, planetR: .3, planetY: 1.58 };
export const cockpitZ = z => z - 10.1;
export const SEATS = { x: 1.3, z: -18.25 };
const V = (x,y,z) => new THREE.Vector3(x,y,z);
export function buildCaravanInterior(batch, group) {
  const deco = new THREE.Group(), props = new THREE.Group();
  deco.name='caravan-room-details'; props.name='caravan-personal-belongings';
  deco.userData.noCollide = props.userData.noCollide = true; group.add(deco,props);
  const box = (mat,x,y,z,w,h,d) => batch.add(mat,new THREE.BoxGeometry(w,h,d).translate(x,y+h/2,z));
  const cyl = (mat,x,y,z,r,h) => batch.add(mat,new THREE.CylinderGeometry(r,r,h,20).translate(x,y+h/2,z));
  const pipe = (mat,a,b,r=.035) => { const d=b.clone().sub(a); batch.add(mat,new THREE.CylinderGeometry(r,r,d.length(),8).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0,1,0),d.normalize())).translate(...a.clone().add(b).multiplyScalar(.5).toArray())); };
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
    box('floor',0,r.floor-.13,(r.z0+r.z1)/2,r.half*2,.13,r.z1-r.z0);
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
      box('ceiling',0,r.ceiling,(STAIRS.z1+r.z1)/2,r.half*2,.12,r.z1-STAIRS.z1);
      for(const side of [-1,1])box('ceiling',side*(r.half+STAIRS.width/2+.25)/2,r.ceiling,(r.z0+STAIRS.z1)/2,r.half-STAIRS.width/2-.25,.12,STAIRS.z1-r.z0);
    } else box('ceiling',0,r.ceiling,(r.z0+r.z1)/2,r.half*2,.12,r.z1-r.z0);
    for(const side of [-1,1]) {
      if(name==='cockpit')continue; // the real curved glazed shell encloses this room
      if(name==='main'&&side<0) {
        for(const [a,b] of [[r.z0,HATCH.z0],[HATCH.z1,r.z1]])box('wall',side*r.half,0,(a+b)/2,.12,r.ceiling,b-a);
        box('wall',side*r.half,HATCH.y1,0,.12,r.ceiling-HATCH.y1,HATCH.z1-HATCH.z0);
      } else box('wall',side*r.half,r.floor,(r.z0+r.z1)/2,.12,r.ceiling-r.floor,r.z1-r.z0);
    }
  }
  // Enclosed tall stairwell: its walls meet the upper ceiling, concealing the shell's service cavities.
  const shaftHalf=STAIRS.width/2+.25, shaftZ=(STAIRS.z0+STAIRS.z1)/2;
  for(const side of [-1,1])box('wall',side*shaftHalf,ROOMS.main.ceiling,shaftZ,.10,ROOMS.cockpit.ceiling-ROOMS.main.ceiling,STAIRS.z1-STAIRS.z0);
  box('ceiling',0,ROOMS.cockpit.ceiling,shaftZ,shaftHalf*2,.12,STAIRS.z1-STAIRS.z0);
  box('wall',0,ROOMS.main.ceiling,STAIRS.z1,shaftHalf*2,ROOMS.cockpit.ceiling-ROOMS.main.ceiling,.10);
  // The upper deck ends at the top riser, leaving the stairwell open overhead.
  const rise=STAIRS.rise/STAIRS.steps, run=(STAIRS.z1-STAIRS.z0)/STAIRS.steps;
  for(let i=0;i<STAIRS.steps;i++) {
    const z=STAIRS.z1-(i+.5)*run;
    box('floor',0,0,z,STAIRS.width,(i+1)*rise,run+.005);
    box('trim',0,(i+1)*rise-.025,z+run/2-.035,STAIRS.width,.025,.07);
  }
  for(const side of [-1,1])pipe('metal',V(side*(STAIRS.width/2+.08),1,STAIRS.z1),V(side*(STAIRS.width/2+.08),COCKPIT_DECK+1,STAIRS.z0),.045);
  // Wide doorways between living room, cabin and hold; no obstacle in the central circulation spine.
  for(const z of [ROOMS.cabin.z0,ROOMS.hold.z0]){
    const half=ROOMS.cabin.half;
    for(const side of [-1,1])box('wall',side*(half+1.15)/2,0,z,half-1.15,3.7,.14);
    box('wall',0,3.25,z,2.3,.45,.14);
  }
  box('wall',0,0,ROOMS.hold.z1,ROOMS.hold.half*2,ROOMS.hold.ceiling,.15);
  // Raised cockpit: the seated eye meets the authored panoramic windshield's real opening.
  box('panel',0,COCKPIT_DECK+.7,-20.0,6.7,.35,.85);
  for(const x of [-SEATS.x,SEATS.x])chair(x,COCKPIT_DECK,SEATS.z);
  for(let i=0;i<16;i++)box(i%3?'btnB':'btnA',-2.5+i*.32,COCKPIT_DECK+1.055,-19.65,.12,.03,.13);
  picture(familyDrawing(),2.3,COCKPIT_DECK+1.35,-19.95,.5,.38);
  // Galley on the port wall: sink, hotplate, cups, kettle and storage.
  cabinet(-2.45,0,-5.7,1.05,.9,3.1);
  box('metal',-2.45,.9,-5.7,1.13,.045,3.2);
  cyl('dark',-2.45,.95,-6.5,.28,.025);cyl('metal',-2.45,.98,-6.5,.19,.25);
  pipe('metal',V(-2.8,1.0,-5.1),V(-2.8,1.35,-5.1));pipe('metal',V(-2.8,1.35,-5.1),V(-2.5,1.35,-5.1));
  for(const z of [-5.4,-5.0])cyl('cream',-2.1,.95,z,.09,.16);
  cabinet(-2.55,2.1,-5.7,.7,.75,2.9);
  // The familiar bunk, strapped books and family note, beside the open living room.
  box('wood',2.15,0,-1.5,1.35,.42,2.4);box('cream',2.15,.42,-1.5,1.27,.16,2.32);
  box('blanket',2.15,.58,-1.85,1.25,.07,1.55);box('pillow',2.15,.59,-.65,.85,.15,.42);block(2.15,0,-1.5,1.4,2.5);
  picture(motherNote(),2.15,1.8,-2.76,.42,.35);books(1.65,1.3,-2.85);
  box('wood',2.1,1.24,-2.85,1.2,.06,.25);
  box('rug',.2,.012,3.25,3.6,.008,4.8);
  box('rugInner',.2,.021,3.25,3.35,.006,4.55);
  for(const z of [-6.7,-6.1,-5.5,-4.9])box('metal',-1.9,.65,z,.035,.04,.24);
  // Human-sized J console, holo table and voicemail. Interaction anchors remain recognizable and central.
  cyl('metal',TABLE.x,0,TABLE.z,.48,TABLE.h);cyl('panel',TABLE.x,TABLE.h,TABLE.z,.72,.08);
  const desk=new THREE.Shape();
  desk.absarc(0,0,1.25,-Math.PI/2,Math.PI/2,false);
  desk.absarc(0,0,.9,Math.PI/2,-Math.PI/2,true);desk.closePath();
  const rim=new THREE.ExtrudeGeometry(desk,{depth:.13,bevelEnabled:false,curveSegments:32}).rotateX(Math.PI/2).translate(TABLE.x,TABLE.h+ .08,TABLE.z);
  batch.add('panel',rim);box('panel',TABLE.x-.9,.78,TABLE.z+1.1,.65,.2,2.1);
  cyl('vmailHalo',TABLE.x-.65,1,TABLE.z+2.0,.18,.035);cyl('vmail',TABLE.x-.65,1.04,TABLE.z+2.0,.09,.035);
  const projector=V(TABLE.x-.6,1.13,TABLE.z+1.55);
  cyl('metal',projector.x,.94,projector.z,.17,.19);
  // Plumb's cradle and coats beside the entry, leaving the entire doorway unobstructed.
  box('wood',-2.7,1.18,-1.7,.65,.08,.55);cyl('metal',-2.7,1.26,-1.7,.22,.08);
  for(let i=0;i<3;i++){box('metal',-2.85,2.0,1.6+i*.45,.08,.08,.08);box('blanket',-2.75,1.2,1.6+i*.45,.15,.75,.28);}
  // Cabin: sofa, a proper table, two chairs and personal books, all secured in flight.
  box('wood',-2.1,0,8.8,1.1,.32,2.4);box('cushion',-2.1,.32,8.8,1.1,.25,2.4);box('cushion',-2.55,.55,8.8,.2,.65,2.4);block(-2.1,0,8.8,1.2,2.5);
  box('wood',1.5,.72,7.6,1.2,.09,1.6);for(const z of [7.0,8.2])pipe('metal',V(1.5,0,z),V(1.5,.72,z),.07);
  chair(1.5,0,8.9);cabinet(2.55,0,9.9,.8,1.3,1.25);books(2.1,1.3,9.65);
  picture(homePhoto(),-1.8,2,10.82,1,.65,true);
  // Hold: cargo and tools to either side; the path to the engine service door stays clear.
  for(const side of [-1,1])for(let i=0;i<3;i++){
    const x=side*1.85,z=12+i*1.25;
    box('crate',x,0,z,.95,.95,1.1);box('metal',x,.95,z,1,.045,.12);
    for(const dx of [-.35,.35])box('dark',x+dx,0,z,.05,.98,1.12);
  }
  box('metal',0,.12,15.99,1.6,2.5,.1);box('dark',0,1.3,15.92,.4,.08,.07);
  picture(starChart(),-1.8,2,6.32,.9,.65,true);
  const lamps=Object.entries(ROOMS).flatMap(([name,r])=>[.25,.75].map(t=>({name,p:V(name==='main'?2.7:0,r.ceiling-.45,r.z0+(r.z1-r.z0)*t),r:7})));
  for(const l of lamps){cyl('lamp',l.p.x,l.p.y,l.p.z,.18,.1);}
  const points={
    wakeEye:V(2.1,.9,-.7),wakeLook:V(.2,1.6,1.5),wakeSit:V(2.1,1.25,-.7),wakeRoom:V(0,1.4,2),bunkStand:V(1.1,0,-.4),bunkStandHeading:Math.PI,
    cockpit:V(TABLE.x-.6,0,TABLE.z+3.1),cockpitHeading:Math.PI,projector,
    seat:V(-SEATS.x,COCKPIT_DECK+.45,SEATS.z),table:V(TABLE.x,TABLE.planetY,TABLE.z),tableFoot:V(TABLE.x,0,TABLE.z),
    hatchIn:V(-WALL_IN+1.1,0,0),hatchHeading:HATCH_A,threshold:V(-3.25,0,0),aboard:V(-.9,0,.2),
    voicemail:V(TABLE.x-.65,1.075,TABLE.z+2),dock:V(-2.7,1.55,-1.7),
  };
  return {deco,props,lamps,points,screen:{centre:V(TABLE.x-.65,1.35,TABLE.z+1.8),normal:V(0,.15,1).normalize(),radius:.23}};
}
