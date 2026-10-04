import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { mulberry32 } from '../noise.js';
import { Taxi } from '../taxi.js';
import { glyphGeometry } from '../story/sign-text.js';
import { LINES as STORY_LINES } from '../story/bazaar-data.js';

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

  const frontPosters=[], towerPosters=[];   // for the story: signs that face the street; the silent tower's own screens
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
    frontPosters.push({x,y:h*.32,z:z+22.2+1.05,w:20,h:24,yaw:0});
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
  const flammables=[];   // the hanging lamps: an ember glob lights a little sun on each (src/flammable.js)
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
      flammables.push({at:new THREE.Vector3(x-side*6.5,3.9,z+dz),kind:'lantern',r:.7,top:.55});
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
    towerPosters.push({x:0,y:y+6,z:-239.9,w:20,h:10,yaw:0,k},{x:-13,y:y+6,z:-255,w:21,h:10,yaw:-Math.PI/2,k},{x:13,y:y+6,z:-255,w:21,h:10,yaw:Math.PI/2,k});
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
  const folk=[];   // kept clear by the crowd
  for(let i=0;i<26;i++) {
    const side=i%2?1:-1,x=side*(17+rng()*2),z=72-Math.floor(i/2)*31,s=.8+rng()*.45;
    folk.push({x,y:0,z,r:.85*s+.15});
    sphere(x,1.1*s,z,.6*s,1.05*s,.42*s,lilac);
    sphere(x,2.05*s,z,.82*s,.42*s,.44*s,lilac);
    for(const dx of [-.26,.26]) sphere(x+dx*s,2.08*s,z+.41*s,.055,.045,.03,dark);
    for(const dx of [-.25,.25]) box(x+dx*s,.17*s,z,.2*s,.34*s,.4*s,ink,false);
  }

  // ---------------------------------------------------------- the story's places (src/story/bazaar.js)
  // The silent tower's screens under dark covers (they wake row by row when the broadcast plays);
  // the antenna's tuning mark, three bulbs over a dish, at the top of the aerial; the oldest sign
  // in the market, hanging dark under the second skybridge; a heap of crates fallen in an alley
  // mouth, over something brass; the quiet one Ummu and its little screen; Sel's crate and radio
  // at the tower's foot; Brush's ladder.
  const signal = (() => {
    const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const story = (o) => { o.userData.noCollide = true; o.traverse?.((c) => { c.userData.noCollide = true; }); scene.add(o); return o; };
    const places = {
      sel: V3(-4.6, 0, -230.6), selSeat: V3(-4.6, 0, -230.6),
      kip: V3(-24, 25, -89.4), ferro: V3(6.5, 44, -231.2), brush: V3(-20.9, .3, -164.5),
      ummu: V3(-20.7, .3, -222.2), crates: V3(-21.4, .3, -216.4), console: V3(0, 45.4, -236.9),
      antenna: V3(12, 61.4, -237.5), oldSign: V3(-20, 20.6, -86.1), square: V3(0, 0, -222), towerTop: V3(0, 98, -240),
    };
    // dark covers over the tower's screens, one mesh per row (the broadcast lifts them bottom to top)
    const coverMat = makeMaterial({ color: '#2f3d43', flat: true, key: 'bazaar.covers' });
    const covers = [], coverGeo = (q) => new THREE.BoxGeometry(q.w + .9, q.h + .9, .12).translate(0, 0, 1.12).rotateY(q.yaw).translate(q.x, q.y, q.z);
    for (let k = 0; k < 7; k++) {
      const m = story(new THREE.Mesh(mergeGeometries(towerPosters.filter((q) => q.k === k).map(coverGeo)), coverMat));
      m.visible = false;   // the rows only while the tower wakes; otherwise one mesh for all of them
      covers.push(m);
    }
    const coversAll = story(new THREE.Mesh(mergeGeometries(towerPosters.map(coverGeo)), coverMat));
    // the tuning mark: three bulbs over a dish, on a short mast above the aerial's lamp
    add(new THREE.CylinderGeometry(.08, .08, 1.7, 5).translate(12, 59.9, -238), brass, false);
    const dish = story(new THREE.Mesh(new THREE.TorusGeometry(1.25, .1, 4, 18, Math.PI * .8).rotateZ(Math.PI * .1).scale(1, .55, 1).translate(0, -.45, 0), brass));
    dish.position.copy(places.antenna);
    const bulbs = [[-1, .52], [0, .9], [1, .52]].map(([bx, by], i) => {
      const m = makeMaterial({ color: '#56686d', flat: true, key: `bazaar.bulb${i}` });
      const b = story(new THREE.Mesh(new THREE.SphereGeometry(.36, 10, 7), m));
      b.position.copy(places.antenna).add(V3(bx, by, .05));
      return { mesh: b, mat: m };
    });
    // the oldest sign: a dark plate hung from the underside of the second bridge on two straps
    const oldMat = makeMaterial({ color: '#3b4547', flat: true, key: 'bazaar.oldsign' });
    const o = places.oldSign;
    add(new THREE.BoxGeometry(.1, 3.4, .1).translate(o.x - 2.6, o.y + 2.2, o.z - .1), ink, false);
    add(new THREE.BoxGeometry(.1, 3.4, .1).translate(o.x + 2.6, o.y + 2.2, o.z - .1), ink, false);
    const oldSign = story(new THREE.Mesh(new THREE.BoxGeometry(6.8, 3.4, .22), oldMat));
    oldSign.position.copy(o);
    add(new THREE.BoxGeometry(7.2, .22, .3).translate(o.x, o.y + 1.8, o.z), ink, false);
    add(new THREE.BoxGeometry(7.2, .22, .3).translate(o.x, o.y - 1.8, o.z), ink, false);
    // the crates, fallen in the alley mouth the night the sky rang; the brass bowl under them
    const crateMats = ['#c99758', '#f5dfab', '#88b4b5', '#f0a083'].map((c) => makeMaterial({ color: c, flat: true, grid: 3 }));
    const crates = [[0, .55, 0, 1.1, 0], [1.05, .5, .35, 1, .4], [-.2, .5, 1.15, 1, .2], [.45, 1.55, .5, .95, .7], [-.9, .45, -.6, .9, .3], [.9, .45, -1, .9, .9]].map(([dx, dy, dz, sz, ry], i) => {
      const m = story(new THREE.Mesh(new THREE.BoxGeometry(sz, sz, sz), crateMats[i % 4]));
      m.position.copy(places.crates).add(V3(dx, dy * (sz / 1.1) + (dy > 1 ? 0 : 0), dz));
      m.rotation.set(0, ry, i === 3 ? .25 : 0);
      return { mesh: m, rest: m.position.clone(), rot: m.rotation.clone() };
    });
    const bowl = story(new THREE.Mesh(new THREE.LatheGeometry([[.05, 0], [.28, .04], [.42, .16], [.44, .24], [.38, .22], [.22, .08], [0, .06]].map(([r, y]) => new THREE.Vector2(r, y)), 12), brass));
    bowl.position.copy(places.crates).add(V3(.15, .02, .3));
    // Ummu, one of the quiet ones: a body, a broad head that turns, a little screen on a pole
    const S = 1.18, U = places.ummu;
    const ummu = new THREE.Group();
    ummu.add(new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9).scale(.6 * S, 1.05 * S, .42 * S).translate(0, 1.1 * S, 0), lilac));
    const head = new THREE.Group();
    head.position.y = 2.05 * S;
    head.add(new THREE.Mesh(new THREE.SphereGeometry(1, 14, 9).scale(.82 * S, .42 * S, .44 * S), lilac));
    for (const dx of [-.26, .26]) head.add(new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4).scale(.06, .05, .03).translate(dx * S, .03, .41 * S), dark));
    ummu.add(head);
    for (const dx of [-.25, .25]) ummu.add(new THREE.Mesh(new THREE.BoxGeometry(.2 * S, .34 * S, .4 * S).translate(dx * S, .17 * S, 0), ink));
    ummu.position.copy(U); ummu.rotation.y = Math.PI / 2;
    story(ummu);
    add(new THREE.CylinderGeometry(.06, .06, 3.6, 5).translate(U.x - .55, U.y + 1.8, U.z - 1.05), ink, false);
    const screen = story(new THREE.Mesh(new THREE.BoxGeometry(.1, 1.0, 2.2), makeMaterial({ color: '#2f3d43', flat: true, key: 'bazaar.ummuScreen' })));
    screen.position.set(U.x - .5, U.y + 3.75, U.z - 1.05);
    places.ummuScreen = V3(U.x - .43, U.y + 3.75, U.z - 1.05);
    // Sel's crate and old radio at the tower's foot; Brush's ladder against a shop sign
    add(new THREE.BoxGeometry(.9, .45, .9).translate(places.selSeat.x, .225, places.selSeat.z - .3), shop[1], false);
    add(new THREE.BoxGeometry(.7, .45, .4).translate(places.selSeat.x + 1.1, .225, places.selSeat.z - .2), dark, false);
    add(new THREE.CylinderGeometry(.03, .03, 1.2, 4).rotateZ(.5).translate(places.selSeat.x + 1.25, .9, places.selSeat.z - .2), brass, false);
    const B = places.brush;
    for (const dz of [-.3, .3]) add(new THREE.BoxGeometry(.08, 6.2, .08).rotateZ(-.18).translate(B.x - .6, 3.3, B.z + dz), cream, false);
    for (let k = 0; k < 9; k++) add(new THREE.BoxGeometry(.06, .06, .66).translate(B.x - .6 - Math.sin(.18) * (k * .65 + .5) + .55, .5 + k * .65, B.z), cream, false);
    for (const [dx, dz, c] of [[-.4, .9, 0], [-.1, 1.2, 2], [-.6, 1.3, 3]]) add(new THREE.CylinderGeometry(.18, .16, .32, 8).translate(B.x + dx, B.y + .16, B.z + dz), shop[c], false);
    // the glyph, small, on the oldest shop in the square (the first sign's mark)
    const g = new THREE.Mesh(glyphGeometry(1.4, .05).rotateY(Math.PI / 2).translate(-24.95, 3.2, -205), dark);
    story(g);
    return { places, covers, coversAll, coverMat, bulbs, dish, oldSign, oldMat, crates, bowl, ummu, ummuHead: head, screen, towerPosters, frontPosters };
  })();
  folk.push({ x: signal.places.ummu.x, y: 0, z: signal.places.ummu.z, r: 1.3 }, { x: signal.places.crates.x, y: 0, z: signal.places.crates.z, r: 2.2 },
    { x: signal.places.sel.x, y: 0, z: signal.places.sel.z, r: 1.8 }, { x: signal.places.brush.x, y: 0, z: signal.places.brush.z, r: 1.6 }, { x: signal.places.brush.x - .5, y: 0, z: signal.places.brush.z + 1, r: .9 });

  for(const {geos,material,solid} of buckets.values()) {
    const mesh=new THREE.Mesh(mergeGeometries(geos),material);
    mesh.userData.noCollide=!solid; mesh.userData.tiled=true;
    mesh.geometry.computeBoundingSphere(); scene.add(mesh);
    geos.forEach(g=>g.dispose());
  }
  const vehicles=[];
  return {
    id:'bazaar', reactiveScreens, signal, ground:{heightAt:()=>0}, spawn:new THREE.Vector3(0,.1,88), spawnHeading:Math.PI,camYaw:0,camPitch:.02,
    features:{mount:false,wind:false,jetpack:true,climb:true,taxis:true}, vehicles, flammables,
    limit:700,killY:-20, defaults:{hour:11.5,preset:'Moebius print',cloudShadows:0,look:{uHatch:.18,uLineWidth:.85,uWobble:.1,uGrain:.025}},
    sky:{script:{day:['#a4d7d1','#e1e6c6','#70969e','#fff1cf','#ffe1ae'],dusk:['#9dabc3','#ffc5a2','#887b9e','#ffd6aa','#ffe5c2'],night:['#243e59','#587581','#55547c','#8daec0','#f9e3ac']}},
    lightAt(p,dir){ if(dir.y>0){dir.set(.12,1,.18).normalize();} },
    atmo:(x,z,y)=>({tint:[1,1,1],fog:.65,name:y>35?'Above the market':z<-190?'Signal Square':'The lantern market'}),
    life:{motes:{count:70,color:'#ffe3aa',size:.035,rise:.1,wind:[.2,0]}},
    crowdLines:['The last broadcast is still waiting above the square.','The relay is above the stacked signs. Rest on the blue ledges.','Fruit from seven moons! Pick one.','Hail a cab if your feet get tired.','Nobody remembers who drew the first advertisement.','The quiet ones listen with their whole heads.'],
    // The market crowd (crowd.js): conversation circles between the walking
    // lanes, strollers along the avenue, sidewalks, skybridges and round the
    // tower, kerb sitters and people leaning on counters and bridge rails.
    // Candidates only: the crowd keeps those on clear, walkable ground.
    crowdSpots(){
      const r=mulberry32(4711),V=(x,y,z)=>new THREE.Vector3(x,y,z);
      const groups=[],walks=[],edges=[],size=()=>2+Math.floor(r()**1.2*4);
      const LANES=[-12,-4.5,4.5,12];
      for(const x of LANES) walks.push({path:[V(x,0,118),V(x,0,-212)],n:10,pair:.45});
      walks.push({path:[V(-15.6,0,-226),V(15.6,0,-226),V(15.6,0,-286),V(-15.6,0,-286)],loop:true,n:9,pair:.5});
      for(const s of [-1,1]) walks.push({path:[V(s*20.8,.3,110),V(s*20.8,.3,-330)],n:6,pair:.25,keepRight:.35,lateral:.75});
      for(const {z,y} of BRIDGES) walks.push({path:[V(-31,y,z),V(31,y,z)],n:3,pair:.5,keepRight:.9,lateral:.9});
      // circles between the lanes along the avenue; denser round the square
      for(let z=114;z>-212;z-=4.5+r()*4) for(const [x,w] of [[0,1.2],[-8.25,.7],[8.25,.7],[-15.2,.25],[15.2,.25]])
        if(r()<(Math.abs(x)>14?.3:.5)) groups.push({at:V(x+(r()-.5)*2*w,0,z+(r()-.5)*3),n:Math.abs(x)>14?2:size()});
      for(let i=0;i<70;i++) {
        const x=(r()-.5)*31,z=-200-r()*130;
        if(Math.abs(x)<14.5&&z<-236&&z>-274) continue;   // the tower
        groups.push({at:V(x,0,z),n:size()});
      }
      for(let z=112;z>-330;z-=6+r()*8) for(const s of [-1,1]) {
        if(r()<.4) edges.push({at:V(s*19.22,.3,z),heading:-s*Math.PI/2,pose:'kerb'});
      }
      // leaning back on the shop counters
      for(let k=0;k<18;k++) for(const s of [-1,1]) for(const dz of [-3.2,0,3.2]) if(r()<.3) edges.push({at:V(s*22.35,.3,100-k*27+dz),heading:-s*Math.PI/2,pose:'wall'});
      // looking down from the skybridges
      for(const {z,y} of BRIDGES) for(let x=-28;x<=28;x+=3.2+r()*3) if(r()<.5) {
        const s=r()<.5?1:-1;
        edges.push({at:V(x,y,z+s*2.82),heading:s>0?0:Math.PI,pose:'rail',rail:.5});   // the rails are drawn only (no collision)
      }
      // who they are depends on where they are: the avenue's market, the square under the silent
      // tower, the skybridges (src/story/bazaar-data.js; the story talks to them by zone)
      const zoneOf=(p)=>p.y>8?'bridge':p.z<-200?'square':'market';
      for(const sp of [...groups,...walks,...edges]){sp.id=zoneOf(sp.at??sp.path[0]);sp.lines=STORY_LINES[sp.id];}
      const P=signal.places, keep=[[P.kip,1.6],[P.ferro,1.6],[P.console,2.2]];
      for(const [q,rr] of keep) folk.push({x:q.x,y:q.y,z:q.z,r:rr});
      return {groups,walks,edges,avoid:folk,farMax:420,costume:'bazaar',palette:{cloaks:['#f0a083','#88b4b5','#e4bd83','#b9a9c5','#94a9bd','#ebce98','#c8483a','#5fb7ad','#d8a24a','#8a6fb8','#62c3c9','#f3ead8']},
        clear:[{x:0,z:88,r:3.5},{x:8,z:82,r:4},{x:-11,z:121,r:5}]};
    },
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
