import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { mulberry32 } from '../noise.js';
import { Taxi } from '../taxi.js';

// A street-level city, separate from the City-Shaft. Repeated details are
// merged by street block and material so the mobile renderer can cull them.
export const SIGNAL = { x: 0, z: -255, deckY: 44, approachZ: -234 };
export const BRIDGES = [{ z: 25, y: 19 }, { z: -90, y: 25 }, { z: -190, y: 72 }, { z: -330, y: 64 }];
export function createBazaar(scene) {
  const rng = mulberry32(20261004), buckets = new Map(), reactiveScreens = [];
  const colors = ['#f0a083', '#e4bd83', '#8dbbb9', '#94a9bd', '#ebce98'];
  const mat = (color, extra = {}) => makeMaterial({ color, flat: true, ...extra });
  const coral = mat('#f0a083', { grid: 12 }), teal = mat('#88b4b5', { grid: 9 });
  const ink = mat('#465c65'), cream = mat('#f5dfab'), brass = mat('#c99758');
  const paving = mat('#a4c1be', { grid: 10 }), lilac = mat('#b9a9c5');
  const dark = mat('#3a535b'), glow = mat('#fff0bd', { glow: 0.75 });
  const shop = colors.map(c => mat(c));
  function add(geo, material, solid = true) {
    geo.computeBoundingBox(); const z = geo.boundingBox.getCenter(new THREE.Vector3()).z;
    const key = `${Math.floor(z / 75)}:${material.uuid}:${solid}`;
    if (!buckets.has(key)) buckets.set(key, { geos: [], material, solid });
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.deleteAttribute('uv'); buckets.get(key).geos.push(g);
  }
  function box(x, y, z, w, h, d, material, solid = true) { add(new THREE.BoxGeometry(w, h, d).translate(x, y, z), material, solid); }
  function tube(points, radius, material, solid = false) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    add(new THREE.TubeGeometry(curve, Math.max(4, points.length * 3), radius, 5, false), material, solid);
  }
  function sphere(x,y,z,rx,ry,rz,material) { add(new THREE.SphereGeometry(1,10,7).scale(rx,ry,rz).translate(x,y,z),material,false); }
  function local(geo, x, y, z, yaw, material) { add(geo.rotateY(yaw).translate(x,y,z),material,false); }

  box(0,-1, -130,1500,2,1500,paving);
  // Broad sidewalks leave a continuous 32 m central walking route.
  for (const side of [-1,1]) box(side*27,.15,-130,16,.3,600,mat('#d5c7a8',{grid:3}));
  // Inlaid tram lines lead the eye from the entrance to the relay.
  for (const x of [-12,12]) box(x,.012,-100,.12,.02,480,brass,false);

  // Billboards are relief illustrations, not noisy microtexture. All faces
  // use the game's ink shader: illustrated heads, planets and alien symbols.
  function poster(x,y,z,w,h,yaw,seed) {
    reactiveScreens.push({pos:new THREE.Vector3(x-Math.sin(yaw)*-.9,y,z+Math.cos(yaw)*.9),w,h,yaw});
    const plate = (g,m) => local(g,x,y,z,yaw,m);
    plate(new THREE.BoxGeometry(w+.9,h+.9,.8),ink);
    plate(new THREE.BoxGeometry(w,h,.3).translate(0,0,.53),shop[seed%shop.length]);
    const faceZ = .78;
    if (seed % 3 === 0) {
      plate(new THREE.SphereGeometry(1,16,10).scale(w*.28,h*.22,.16).translate(0,h*.12,faceZ),lilac);
      plate(new THREE.SphereGeometry(1,12,8).scale(w*.39,h*.22,.13).translate(0,-h*.26,faceZ),dark);
      for(const sx of [-1,1]) plate(new THREE.BoxGeometry(w*.08,h*.025,.07).translate(sx*w*.1,h*.14,faceZ+.17),cream);
      plate(new THREE.TorusGeometry(w*.32,.12,4,32).scale(1,h/w*.7,1).translate(0,h*.12,faceZ+.2),glow);
    } else if (seed % 3 === 1) {
      plate(new THREE.CircleGeometry(w*.25,24).translate(0,h*.06,faceZ),cream);
      plate(new THREE.TorusGeometry(w*.34,.18,4,32).scale(1,.33,1).rotateZ(.4).translate(0,h*.06,faceZ+.1),dark);
      for(let i=0;i<3;i++) plate(new THREE.BoxGeometry(w*(.55-i*.12),.3,.08).translate(0,-h*.31-i*.7,faceZ),glow);
    } else {
      for(let i=0;i<4;i++) {
        const yy=h*(.32-i*.21);
        plate(new THREE.BoxGeometry(w*.5,.5,.1).translate(0,yy,faceZ),glow);
        plate(new THREE.BoxGeometry(.6,h*.1,.1).translate((i%2 ? 1:-1)*w*.13,yy-h*.05,faceZ),glow);
      }
    }
    for(let i=0;i<4;i++) plate(new THREE.BoxGeometry(w*.12,.25,.06).translate((i-1.5)*w*.2,-h*.43,faceZ+.02),cream);
  }

  // Tower canyon. Setbacks and exposed service stacks break up the slabs.
  for(let row=0;row<9;row++) for(const side of [-1,1]) {
    const z=105-row*60, x=side*(54+(row%3)*3), h=125+rng()*130, w=34+rng()*7;
    const body = row%3===0 ? coral : row%3===1 ? teal : mat(colors[(row+(side+1))%5],{grid:11});
    box(x,h/2,z,w,h,43,body);
    box(x,h+7,z,w*.7,14,31,body);
    box(x+side*5,h+23,z,1.4,32,1.4,ink,false);
    const face=x-side*(w/2+.5), yaw=-side*Math.PI/2;
    // Layered horizontal cornices and vertical strips; dark recesses stay large.
    for(let k=1;k<6;k++) box(face, k*h/6,z,1.2,.7,44,ink,false);
    for(const dz of [-16,16]) {
      box(face-side*.6,h*.48,z+dz,.6,h*.87,1,cream,false);
      tube([[face-side*1.3,9,z+dz],[face-side*1.3,34,z+dz],[face-side*2.8,37,z+dz],[face-side*2.8,h*.8,z+dz]],.3,ink);
    }
    poster(face-side*1.2,h*.61,z,20,40,yaw,row+(side===1?2:0));
    poster(face-side*1.6,20,z+9,7,13,yaw,row+1);
    // Forward-facing signs are legible as you enter the street.
    poster(x,h*.32,z+22.2,20,24,0,row+2);
    for(let k=0;k<5;k++) {
      box(face-side*1.6,5+k*2.1,z-12,2,1.3,5,teal,false);
      box(face-side*2.7,5+k*2.1,z-12,.15,.5,3,dark,false);
    }
    // Narrow service balconies give climbers somewhere to rest.
    for(let k=0;k<4;k++) box(face-side*2.5,8+k*8,z-6,6,.65,11,teal);
  }
  // A second row creates a skyline above side streets.
  for(let i=0;i<22;i++) {
    const side=i%2?1:-1, x=side*(108+rng()*95),z=140-Math.floor(i/2)*62,h=160+rng()*150;
    box(x,h/2,z,25+rng()*18,h,34,mat(colors[i%5],{grid:14}));
    box(x,h+19,z,2,38,2,cream,false);
  }
  // Distant slender needle behind the square, framed by the foreground towers.
  box(0,220,-455,18,440,18,teal);
  for(const x of [-6,0,6]) box(x,230,-444.8,.5,440,.4,cream,false);
  box(0,465,-455,1.5,70,1.5,brass,false);

  // Market frontage: awnings, stacked shop signs, produce and hanging lamps.
  for(let i=0;i<36;i++) {
    const side=i%2?1:-1, z=100-Math.floor(i/2)*27, x=side*29;
    const body=shop[i%5], yaw=-side*Math.PI/2;
    box(x,2,z,8,4,12,body);
    box(x-side*4.05,2,z,.12,2.9,10,dark,false);
    box(x-side*5,1.1,z,2.6,2.2,10,teal);
    // Tilted canopy, with a scalloped edge made from alternating strips.
    for(let k=0;k<7;k++) {
      const awning=new THREE.BoxGeometry(7,.18,1.7).rotateZ(side*.14).translate(x-side*2.1,4.8,z+(k-3)*1.7);
      add(awning,k%2?cream:body,false);
    }
    poster(x-side*4.3,6.4,z,10,2,yaw,i+2);
    for(const dz of [-5,5]) {
      box(x-side*6.5,2.3,z+dz,.12,4.6,.12,brass,false);
      sphere(x-side*6.5,3.9,z+dz,.45,.6,.45,glow);
    }
    for(let k=0;k<10;k++) {
      const zz=z-4+k*.88;
      sphere(x-side*5.1,2.38,zz,.3,.25,.32,shop[(i+k)%5]);
    }
    box(x+side*4,1,z+8,2,2,2,brass);
    box(x+side*4,2.5,z+8,1.5,1,1.5,cream);
  }

  // Continuous solid bridge decks, rails and suspension service cables.
  for(const {z,y} of BRIDGES) {
    box(0,y-.5,z,86,1,7,teal);
    for(const dz of [-3.4,3.4]) {
      box(0,y+1.25,z+dz,86,.16,.16,brass,false);
      for(let x=-42;x<=42;x+=3) box(x,y+.6,z+dz,.12,1.2,.12,ink,false);
      tube([[-44,y-1,z+dz],[-20,y-5,z+dz],[20,y-5,z+dz],[44,y-1,z+dz]],.13,ink);
    }
    for(let x=-40;x<=40;x+=8) box(x,y-1.3,z,1.1,1.5,7.5,ink,false);
  }
  for(let i=0;i<9;i++) {
    const z=85-i*57,y=12+(i%3)*5;
    tube([[-39,y+4,z],[-13,y,z+4],[16,y-1,z+5],[39,y+6,z+8]],.075,ink);
  }

  // Broadcast stack at the avenue's end: six reachable resting platforms.
  box(0,46,-255,19,92,24,teal);
  for(let k=0;k<7;k++) {
    const y=12+k*13;
    box(0,y,-255,25,1.2,29,ink);
    poster(0,y+6,-239.9,20,10,0,k);
    poster(-13,y+6,-255,21,10,-Math.PI/2,k+1);
    poster(13,y+6,-255,21,10,Math.PI/2,k+2);
  }
  for(let k=1;k<=6;k++) box(k%2?-7:7,k*6,-238,12,.65,8,teal);
  box(0,SIGNAL.deckY-.5,SIGNAL.approachZ,30,1,12,cream);
  // Roof console and aerial, with an open front landing edge.
  box(0,45.2,-238,3,2.4,1.6,coral);
  box(0,46,-237.1,2,.8,.12,glow,false);
  tube([[11,44,-238],[11,58,-238],[12,59,-238]],.15,brass);
  sphere(12,59,-238,.6,.6,.6,glow);

  // Quiet lavender inhabitants beside the shops: broad heads, tiny eyes.
  // Batched with the street furniture, so they don't require skeletal updates.
  for(let i=0;i<26;i++) {
    const side=i%2?1:-1,x=side*(17+rng()*2),z=72-Math.floor(i/2)*31,s=.8+rng()*.45;
    sphere(x,1.1*s,z,.6*s,1.05*s,.42*s,lilac);
    sphere(x,2.05*s,z,.82*s,.42*s,.44*s,lilac);
    for(const dx of [-.26,.26]) sphere(x+dx*s,2.08*s,z+.41*s,.055,.045,.03,dark);
    for(const dx of [-.25,.25]) box(x+dx*s,.17*s,z,.2*s,.34*s,.4*s,ink,false);
  }

  for(const {geos,material,solid} of buckets.values()) {
    const mesh=new THREE.Mesh(mergeGeometries(geos),material);
    mesh.userData.noCollide=!solid; mesh.userData.tiled=true;
    mesh.geometry.computeBoundingSphere(); scene.add(mesh);
    geos.forEach(g=>g.dispose());
  }
  const vehicles=[];
  return {
    id:'bazaar', reactiveScreens, ground:{heightAt:()=>0}, spawn:new THREE.Vector3(0,.1,88), spawnHeading:Math.PI,camYaw:0,camPitch:.02,
    features:{mount:false,wind:false,jetpack:true,climb:true,taxis:true}, vehicles,
    limit:700,killY:-20, defaults:{hour:11.5,preset:'Moebius print',cloudShadows:0,look:{uHatch:.18,uLineWidth:.85,uWobble:.1,uGrain:.025}},
    sky:{script:{day:['#a4d7d1','#e1e6c6','#70969e','#fff1cf','#ffe1ae'],dusk:['#9dabc3','#ffc5a2','#887b9e','#ffd6aa','#ffe5c2'],night:['#243e59','#587581','#55547c','#8daec0','#f9e3ac']}},
    lightAt(p,dir){ if(dir.y>0){dir.set(.12,1,.18).normalize();} },
    atmo:(x,z,y)=>({tint:[1,1,1],fog:.65,name:y>35?'Above the market':z<-190?'Signal Square':'The lantern market'}),
    life:{motes:{count:70,color:'#ffe3aa',size:.035,rise:.1,wind:[.2,0]}},
    crowdLines:['The last broadcast is still waiting above the square.','The relay is above the stacked signs. Rest on the blue ledges.','Fruit from seven moons! Pick one.','Hail a cab if your feet get tired.','Nobody remembers who drew the first advertisement.','The quiet ones listen with their whole heads.'],
    crowd(){return Array.from({length:24},(_,i)=>{const x=(i%2?1:-1)*(4+(i%4)*2.5),z=95-Math.floor(i/2)*31;return [new THREE.Vector3(x,0,z),new THREE.Vector3(x,0,z-22)];});},
    init(physics){
      for(let i=0;i<12;i++) {
        const lane=(t,taxi)=>{
          const a=t*.055+i*Math.PI/6;
          taxi.pos.set(Math.sin(a)*22,[35,52,100][i%3],Math.cos(a)*240-120);
          taxi.heading=Math.atan2(Math.cos(a)*22,-Math.sin(a)*240); taxi.bank=Math.sin(a)*.12;
        };
        const taxi=new Taxi(physics,i%3?'#e9b45f':'#e5cba0',1,lane);
        taxi.update(0,null,0);scene.add(taxi.object);vehicles.push(taxi);
      }
      // One parked cab makes vertical exploration available immediately.
      vehicles[0].pos.set(8,1.2,82); vehicles[0].mode='parked';vehicles[0].parkY=1.2;vehicles[0].idle=0;
      vehicles[0].update(0,null,0);
    },
    dynamic:()=>vehicles,
    update(dt,t,ctx){Taxi.playerPos=ctx?.player?.pos;},
  };
}
