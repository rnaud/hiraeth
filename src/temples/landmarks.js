// Exterior silhouettes from the author's fourteen Midjourney favourites, 14 October 2026.
// references/temples/landmarks-2026-10-14/manifest.json links every drawing to its selected job.
// The existing exteriors own their entrances, approaches and moving story props. These are their
// new structural shells, in the same TempleKit frame. Every structural surface is solid as drawn.
import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { stone, ceramic, metal, pearl, nacre, glazing } from './landmark-materials.js';
import { T, box, lathe, paint, annulus } from './kit.js';

const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ivory = stone('#f4ecd9', {course: 3.8, width: 8, wear: .18}), gold = metal('#dca453');
const navy = paint('#263c52'), coral = ceramic('#ef9c93');
export const LAMP_CROWN_LIFT = 16;
// Scale the architecture around the retained walking plane; doorways stay human-sized.
export const LANDMARK_SCALE = Object.freeze({
  desert: [1.3, 1.25, 1], arzach: [1.2, 1.2, 1], arzach2: [1.65, 1.7, 1],
  perdide: [1.1, 1.1, 1], edena: [1.35, 1.35, 1], incal: [1.6, 1.5, 1],
  buried: [1.25, 1.25, 1], spheres: [1.7, 1.65, 1], bazaar: [1.15, 1.2, 1],
});
export function landmarkFrame(K, id, floor = 0) {
  const scale = LANDMARK_SCALE[id];
  if (!scale) return K;
  const framed = Object.create(K);
  framed.frame = K.frame.clone().multiply(new THREE.Matrix4().makeTranslation(0, floor, 0))
    .multiply(new THREE.Matrix4().makeScale(...scale)).multiply(new THREE.Matrix4().makeTranslation(0, -floor, 0));
  framed.inv = framed.frame.clone().invert();
  return framed;
}
export function landmark(K, id, options = {}) {
  const floor = id === 'incal' || id === 'bazaar' ? 0 : options.y ?? 0;
  const top = buildLandmark(landmarkFrame(K, id, floor), id, {...options, entrance: K});
  return floor + (top - floor) * (LANDMARK_SCALE[id]?.[1] ?? 1);
}

// The picked drawings have broad, continuous surfaces. Their contours are modelled
// individually here; a thin pair of generic fins does not preserve those proportions.
function outline(commands) {
  const s = new THREE.Shape();
  for (const [op, ...args] of commands) s[{ M: 'moveTo', L: 'lineTo', C: 'bezierCurveTo', Q: 'quadraticCurveTo' }[op]](...args);
  s.closePath(); return s;
}
function volume(K, mat, commands, { y = 0, z = 0, depth = 8, bevel = 0.3, sign = 1, holes = [] } = {}) {
  const s = outline(commands); s.holes.push(...holes);
  const g = new THREE.ExtrudeGeometry(s, { depth, curveSegments: 20, bevelEnabled: bevel > 0, bevelSegments: 2, bevelSize: bevel, bevelThickness: bevel }).translate(0, 0, -depth / 2);
  if (sign < 0) g.rotateY(Math.PI);
  K.both(mat, g.translate(0, y, z));
}
function slot(x, low, high, width) {
  const r = width / 2, p = new THREE.Path();
  p.moveTo(x-r, low+r); p.lineTo(x-r, high-r); p.absarc(x,high-r,r,Math.PI,0,true);
  p.lineTo(x+r, low+r); p.absarc(x,low+r,r,0,-Math.PI,true); p.closePath(); return p;
}
function arch(K, mat, { w = 16, h = 24, dw = 6, dh = 15, y = 0, z = 15, depth = 3 } = {}) {
  // An arch joined to the ground at both feet, with an actual open passage.
  volume(K, mat, [['M',-w/2,0],['Q',-w*.38,h*.77,0,h],['Q',w*.38,h*.77,w/2,0],['L',dw/2,0],['L',dw/2,dh*.48],['Q',dw*.44,dh*.88,0,dh],['Q',-dw*.44,dh*.88,-dw/2,dh*.48],['L',-dw/2,0]], {y,z,depth,bevel:.15});
}
function symbol(K, x, y, z, scale = 1, mat = navy) {
  for (const [dx,dy] of [[-1.05,0],[1.05,0],[0,-1.15]]) K.add(mat,disc(.42*scale,.08,[x+dx*scale,y+dy*scale,z]));
  K.add(mat,T(new THREE.TorusGeometry(1.8*scale,.09*scale,4,28,Math.PI),[x,y+.5*scale,z]));
}
function seams(K, mat, paths, z, y = 0, radius = .045) {
  for (const pts of paths) K.add(mat,tube(pts.map(([x,h])=>[x,h+y,z]),radius));
}
function terrace(K, mat, rx, rz, y, h) {
  K.both(mat,new THREE.CylinderGeometry(1,1.04,h,48).scale(rx,1,rz).translate(0,y+h/2,0));
}

function tube(points, r = 0.3, segments = 24, radial = 6) { return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => V(...p))), segments, r, radial); }
function ring(r, t, p, scale = [1, 1, 1]) { return T(new THREE.TorusGeometry(r, t, 8, 48), p, [0, 0, 0], scale); }
function disc(r, d, p, scale = [1, 1, 1]) { return T(new THREE.CylinderGeometry(r, r, d, 48).rotateX(Math.PI / 2), p, [0, 0, 0], scale); }
function dome(K, mat, r, y, height) { K.both(mat, new THREE.SphereGeometry(r, 40, 16, 0, TAU, 0, Math.PI / 2).scale(1, height / r, 1).translate(0, y, 0)); }
function drum(K, mat, r, y, h) { K.both(mat, new THREE.CylinderGeometry(r, r + 0.5, h, 40).translate(0, y + h / 2, 0)); }
function notchedDrum(K,mat,r,y,h,doorWidth=8) {
  const half=doorWidth/2,a=Math.acos(half/r),shape=new THREE.Shape();
  shape.absarc(0,0,r,a,Math.PI-a,true);
  shape.lineTo(-half,0);shape.lineTo(half,0);shape.closePath();
  K.both(mat,new THREE.ExtrudeGeometry(shape,{depth:h,curveSegments:48,bevelEnabled:false}).rotateX(Math.PI/2).translate(0,y+h,0));
}

// A continuous, rounded shell sweep. The growth folds change the surface itself,
// so the lip catches light and has thickness from every viewing direction.
function shellSweep(points, radii, depths, {steps=96, sides=24, folds=38}={}) {
  const curve=new THREE.CatmullRomCurve3(points.map(p=>V(...p))), positions=[], indices=[];
  const sample=(list,t)=>{const u=t*(list.length-1),i=Math.min(list.length-2,Math.floor(u));return THREE.MathUtils.lerp(list[i],list[i+1],u-i);};
  const point=(t,a,offset=0)=>{
    const c=curve.getPoint(t),d=curve.getTangent(t),n=V(-d.y,d.x,0).normalize();
    const fold=1+.022*Math.sin(t*TAU*folds)+.006*Math.sin(t*TAU*folds*2);
    return c.addScaledVector(n,Math.cos(a)*(sample(radii,t)*fold+offset)).add(V(0,0,Math.sin(a)*(sample(depths,t)*fold+offset)));
  };
  for(let i=0;i<=steps;i++)for(let j=0;j<=sides;j++)positions.push(...point(i/steps,j*TAU/sides).toArray());
  for(let i=0;i<steps;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,a+1,b,b,a+1,b+1);}
  // Ends are capped with fans, including the tips sunk into the seabed.
  for(const i of [0,steps]){const center=positions.length/3;positions.push(...curve.getPoint(i/steps).toArray());for(let j=0;j<sides;j++){const a=i*(sides+1)+j;indices.push(...(i===0?[center,a+1,a]:[center,a,a+1]));}}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  return {geometry,point};
}
/** y is the retained entrance's floor, except the Belfry (its gallery). */
function buildLandmark(K, id, { y = 0, R = 15, bottom = 0, glass = null, accent = null, ground = null, entrance = K } = {}) {
  const previousMaterials = K.M;
  K.M = { ...K.M, paintLook: { ...K.M?.paintLook, detail: false } };
  try { switch (id) {
    case 'desert': {
      const red=stone('#ef5845',{course:5.5,width:10,wear:.65}), edge=paint('#b8423d');
      // Each successive solid tier is narrower. A full-height outer drum would
      // swallow these treads, leaving the house sitting directly on the sand.
      for(let i=0;i<12;i++)terrace(K,red,R+9+(11-i)*1.3,R+7+(11-i)*1.3,bottom,y-(11-i)*.44-bottom);
      // Uneven weathered monoliths: heavy feet, narrowing shoulders, a broken crown.
      const fin=[['M',4.3,-.2],['L',23,-.2],['L',20,11],['L',17,17],['L',16,39],['L',13,55],['L',11.7,77],['L',8.5,83],['L',6.8,82],['L',6.1,65],['L',4.4,49],['L',4.3,-.2]];
      volume(K,red,fin,{y,z:0,depth:18,bevel:.6});
      volume(K,red,fin.map(([op,...c])=>[op,...c.map((v,i)=>i%2?v*1.15:v)]),{y,z:0,depth:18,bevel:.6,sign:-1});
      volume(K,edge,[['M',-4.5,-.2],['L',4.5,-.2],['L',4.5,43],['Q',0,49,-4.5,43]],{y,z:-2,depth:10,bevel:.7});
      K.both(ceramic('#73ccb9'),disc(5.8,2,[0,y+66,2]));
      symbol(K,-12,y+52,9.7,1.4,edge);
      for(const sign of [-1,1])seams(K,edge,[[[sign*7,73],[sign*9,62],[sign*10,50],[sign*12,38]],[[sign*11,68],[sign*14,67]],[[sign*9,41],[sign*15,40]],[[sign*6,22],[sign*16,20]]],9.7,y,.07);
      arch(entrance,red,{w:17,h:16,dw:6.8,dh:10,y,z:R+1,depth:4});
      return y+97;
    }
    case 'arzach': {
      const ochre=stone('#e9ad77',{course:2.2,width:5.7,wear:.12}), pale=stone('#f6d8ac',{course:3.1,width:6.8,wear:.15}), shade=stone('#d79783',{course:3.1,width:6.8,wear:.15}), blue=ceramic('#409aa8');
      for(let i=0;i<3;i++)terrace(K,ochre,46-i*4,R+14-i*2,i*y/3,y/3);
      terrace(K,ochre,42,R-2,y,1.4);
      // The low shoulders, wing and needle are one swept mass, as in the drawing.
      K.both(ochre,new THREE.SphereGeometry(1,40,20,0,TAU,0,Math.PI/2).scale(36,12,R-2).translate(0,y+1.4,0));
      const sweep=[['M',2,14],['L',18,12],['C',33,13,55,25,62,30],['C',43,23,20,24,13,32],['C',8,40,7,57,4.2,67],['Q',3.4,70,2.5,67],['L',2,14]];
      for(const sign of [-1,1]) volume(K,sign<0?shade:pale,sweep,{y,z:1,depth:14,sign,bevel:.65});
      // Slender black cleft: it ends at the arch, rather than exposing sky down to the ground.
      volume(K,navy,[['M',-1.6,18],['L',-1.6,51],['Q',0,59,1.6,51],['L',1.6,18]],{y,z:7.4,depth:.3,bevel:0});
      arch(entrance,ochre,{w:24,h:29,dw:12,dh:24,y,z:R-1,depth:8});
      arch(entrance,blue,{w:15.2,h:24,dw:6,dh:17.8,y,z:R+2.5,depth:1.5});
      symbol(K,20,y+7,10.9,1.7,accent??navy);
      seams(K,paint('#b98b70'),[[[4,64],[5,52],[7,39],[10,31],[22,26],[40,25]],[[7,42],[10,41]],[[12,29],[17,28]],[[26,23],[29,20]],[[37,25],[40,24]]],8.72,y);
      for(const sign of [-1,1])seams(K,paint('#ad806f'),[
        [[sign*3.6,60],[sign*4.4,48],[sign*7,35],[sign*15,28],[sign*35,26],[sign*52,28]],
        [[sign*5.8,51],[sign*7.4,43]],[[sign*6.7,42],[sign*9.2,41]],
        [[sign*9,34],[sign*12,33]],[[sign*13,28],[sign*14.5,25]],
        [[sign*20,26],[sign*21.5,19]],[[sign*27,26],[sign*28.5,21]],
        [[sign*33,26],[sign*34,23]],[[sign*42,27],[sign*44,26]],
      ],8.72,y,.055);
      K.both(ivory,new THREE.CylinderGeometry(3.4,3,.8,24).translate(0,y+37.4,-4));
      return y+70;
    }
    case 'arzach2': {
      const pink=stone('#e4aaa3',{course:6,width:9,wear:.7}), recess=paint('#b67d83');
      drum(K,ivory,R,bottom,y-bottom);
      K.both(ivory,box(44,5,27,0,y+2.5,-.5));
      // Faceted fractures interrupt the pillars' edges, rather than making two clean posts.
      const pylon=[['M',7,5],['L',18,5],['L',17,21],['L',15.6,23],['L',17.2,25],['L',16.5,44],['L',15.3,46],['L',16.7,49],['L',15.3,77],['L',8.2,77],['L',8.5,52],['L',7.4,48],['L',8.6,41],['L',7.8,25],['L',6.8,22]];
      for(const sign of [-1,1]){
        volume(K,pink,pylon,{y,depth:14,sign,bevel:.45});
        seams(K,recess,[[[sign*9,16],[sign*13,21],[sign*17,22]],[[sign*8,41],[sign*11,46],[sign*15,47]],[[sign*11,30],[sign*11,38]],[[sign*11,56],[sign*12,70]]],7.6,y,.09);
      }
      K.both(ivory,box(21,4,11,0,y+57,0));
      K.both(navy,ring(1.8,.42,[0,y+52,0]));
      K.both(navy,box(.7,3,1,0,y+54,0));
      K.both(metal('#66503b', 'brass'),lathe([[.01,0],[7.6,0],[7.3,2],[5.4,4],[3.7,15],[3.1,19],[.01,20]],40).translate(0,y+29,0));
      K.both(gold,new THREE.SphereGeometry(.75,12,8).translate(0,y+29,0));
      symbol(K,0,y+57,5.6,1.1);
      return y+78;
    }
    case 'perdide': {
      const lavender=ceramic('#c9b8de'), shadow=stone('#9686b2');
      terrace(K,shadow,R+22,R+14,0,y);
      drum(K,shadow,R-.5,y,7);
      // A broad, shallow peristyle under the choir, with open bays at its foot.
      terrace(K,lavender,R+25,R+16,y+7.2,1);
      for(let i=0;i<24;i++){
        const a=i*TAU/24; if(Math.abs(Math.sin(a))<.18 && Math.cos(a)>0)continue;
        K.both(ivory,new THREE.CylinderGeometry(.3,.45,7.1,10).translate(Math.sin(a)*(R+22),y+3.55,Math.cos(a)*(R+13)));
      }
      const central=[['M',-21,3],['Q',-11,6,-9,22],['L',-7,83],['L',-3.4,86],['L',3.4,86],['L',7,83],['L',9,22],['Q',11,6,21,3]];
      volume(K,lavender,central,{y,z:0,depth:15,bevel:.6,holes:[slot(0,25,84.5,5.4)]});
      K.both(navy,new THREE.ShapeGeometry(new THREE.Shape(slot(0,25,84.5,5.4).getPoints(32))).translate(0,y,6.9));
      for(const [x,h] of [[-15,77],[15,69]]){
        const sign=Math.sign(x);volume(K,lavender,[['M',sign*9,3],['L',sign*27,3],['Q',sign*19,7,sign*18,23],['L',sign*16,h],['L',sign*13,h+2],['L',sign*12,20]],{y,z:-2,depth:9,bevel:.45});
      }
      symbol(K,0,y+15,8.2,2.3);
      K.add(shadow,ring(5.5,.08,[0,y+15,8.2]));
      K.both(accent??paint('#8bdedc'),new THREE.OctahedronGeometry(1.3,1).scale(.7,3.4,.8).translate(0,y+30,7.8));
      return y+87;
    }
    case 'perdide2': {
      const slate=stone('#465a78',{course:2.4,width:4.8,wear:.55}), crown=y+LAMP_CROWN_LIFT;
      drum(K,slate,R+1,-1,y+1);
      K.both(slate,lathe([[R,y],[7,y+8],[4.5,crown+31],[4.5,crown+36]],40));
      const buttress=[['M',4,-4.4],['L',25,-4.4],['L',25,-1.8],['Q',11,15,5.5,38],['L',4.2,38]];
      for(const a of [-Math.PI/6,-5*Math.PI/6,Math.PI/2]){const shape=outline(buttress);K.both(slate,new THREE.ExtrudeGeometry(shape,{depth:3.2,bevelEnabled:false,curveSegments:20}).translate(0,0,-1.6).scale(1,(36+LAMP_CROWN_LIFT)/38,1).rotateY(a).translate(0,y,0));}
      // A thin saucer with radiating ribs, and a large cylindrical glass lantern above it.
      K.both(ceramic('#f1e6cc',{lampTint:['#ffd192',.85]}),lathe([[4,crown+34],[10,crown+35],[20,crown+38],[20,crown+38.4],[7,crown+39],[4,crown+38]],64));
      for(let i=0;i<24;i++){const a=i*TAU/24;K.add(paint('#b5aaa4'),tube([[Math.sin(a)*4,crown+34,Math.cos(a)*4],[Math.sin(a)*12,crown+35.7,Math.cos(a)*12],[Math.sin(a)*20,crown+38.2,Math.cos(a)*20]],.055));}
      for(let i=0;i<12;i++){const a=i*TAU/12;K.both(navy,tube([[Math.sin(a)*6.3,crown+39,Math.cos(a)*6.3],[Math.sin(a)*6.3,crown+50,Math.cos(a)*6.3],[Math.sin(a)*4.7,crown+54,Math.cos(a)*4.7]],.16));}
      for(const h of [39,44,49])K.both(navy,T(new THREE.TorusGeometry(6.35,.12,5,48),[0,crown+h,0],[Math.PI/2,0,0]));
      dome(K,navy,4.7,crown+53.5,1.4);
      symbol(K,0,y+29,4.8,1.15);
      return crown+56;
    }
    case 'edena': {
      const mint=paint('#dce8d5'), pane=glass??glazing('#acd9de',V(0,y+36,0));
      // Broad low glasshouse. The arching ivory cheeks spread into its coral roof.
      const rib=[['M',4.8,14],['L',40,14],['C',20,18,10,33,8,46],['L',6.9,65],['Q',5.8,70,5.1,65],['L',4.8,14]];
      for(const sign of [-1,1])volume(K,ivory,rib,{y,z:0,depth:10,sign,bevel:.6});
      const bud=lathe([[5, y+13],[5,y+38],[4.5,y+48],[3,y+58],[0.01,y+64]],40);
      K.both(pane,bud);
      for(let i=0;i<12;i++){const a=i*TAU/12;K.add(mint,tube([[Math.sin(a)*5.07,y+14,Math.cos(a)*5.07],[Math.sin(a)*5.07,y+38,Math.cos(a)*5.07],[Math.sin(a)*4.6,y+48,Math.cos(a)*4.6],[Math.sin(a)*3.08,y+58,Math.cos(a)*3.08],[0,y+64,0]],.08));}
      for(const [h,r]of [[22,5.1],[31,5.1],[40,5],[48,4.6],[55,3.7]])K.add(mint,T(new THREE.TorusGeometry(r,.07,4,48),[0,y+h,0],[Math.PI/2,0,0]));
      K.both(coral,lathe([[45,y+9],[44,y+12.8],[38,y+15],[30,y+15.3],[30,y+14.5],[38,y+14.2],[43,y+12.2],[44,y+9]],64).scale(1,1,.34));
      volume(entrance,ivory,[['M',-4.2,0],['L',-2.2,0],['L',-2.2,6.8],['Q',0,11.2,2.2,6.8],['L',2.2,0],['L',4.2,0],['L',3.5,17],['Q',0,20,-3.5,17]],{y,z:R+1,depth:2,bevel:.2});
      symbol(entrance,0,y+14,R+2.3,.8);
      return y+70;
    }
    case 'incal': {
      const cream=stone('#f2dfbf',{course:3.5,width:9,wear:.2}), blue=ceramic('#183d73');
      for(const [w,d,yy,h]of [[54,30,0,4],[47,27,4,5],[38,24,9,5],[30,20,14,5]])K.both(cream,box(w,h,d,0,yy+h/2,-2));
      for(const [x,z,h,w]of [[-11,-1,76,5],[-5,-5,83,6],[5,-4,79,5],[11,0,66,4]])volume(K,blue,[['M',x-w,17],['L',x+w,17],['L',x+w*.65,h],['L',x-w*.35,h+5]],{z,depth:8,bevel:.3});
      volume(K,cream,[['M',-6,18],['L',7,18],['L',5,61],['L',1,69],['L',-3,63]],{z:7,depth:6,bevel:.4});
      K.both(gold,ring(5.9,.7,[0,49,10.8]));
      K.both(makeMaterial({color:'#fff0bc',glow:.82,hatch:0}),disc(5.25,.5,[0,49,11]));
      symbol(K,-.4,61,10.5,1.3,blue);
      arch(entrance,cream,{w:16,h:27,dw:5.5,dh:17,y:1.8,z:R+6,depth:3});
      return 89;
    }
    case 'garage': {
      const cream=stone('#f6edda',{course:2.6,width:4.8,wear:.13}), seam=paint('#cbbda1');
      drum(K,cream,R+7,0,y);terrace(K,cream,R+5,R-1,y,2);
      // Continuous facade cradles the dial, with unequal hooked ends.
      volume(K,cream,[['M',-11,0],['L',11,0],['L',9,28],['L',8.6,46],['L',6.9,47],['L',6.5,38],['Q',0,25,-6,36],['L',-5.6,46],['Q',-5,54,1,57],['L',.5,58],['Q',-8,55,-8.6,46],['L',-11,0]],{y,z:0,depth:9,bevel:.35});
      for(const sign of [-1,1]){
        K.both(cream,T(new THREE.TorusGeometry(9,.9,8,36,Math.PI),[sign*10,y+2,-2]));
        for(let i=1;i<5;i++){const a=i*Math.PI/5;K.both(cream,T(new THREE.BoxGeometry(.7,7.5,1.5).translate(0,3.75,0),[sign*10,y+2,-2],[0,0,-a+Math.PI/2]));}
      }
      seams(K,seam,[[[-10,7],[10,7]],[[-9.7,13],[9.7,13]],[[-9.2,19],[9.2,19]],[[-8.8,25],[8.8,25]],[[-5,2],[-5,31]],[[3,2],[3,31]]],4.9,y);
      arch(entrance,cream,{w:6,h:8,dw:3.3,dh:6.8,y,z:R+1.2,depth:2});
      return y+59;
    }
    case 'buried': {
      const rust=metal('#c94d32','iron'), seam=paint('#b7ad9c');
      notchedDrum(K,rust,R+6,bottom,y-bottom+6.5);
      for(const h of [1.1,5.8]) notchedDrum(K,rust,R+6.25,y+h,.2);
      for(let i=0;i<48;i++){const a=i*TAU/48; for(const h of [1.5,5.4]) K.add(navy,new THREE.SphereGeometry(.15,6,4).translate(Math.sin(a)*(R+6.3),y+h,Math.cos(a)*(R+6.3)));}
      const fin=[['M',4.4,6],['L',22,6],['C',18,20,13,47,6.7,69],['Q',5,73,3.2,72],['Q',2.2,72,2.8,69],['C',6,57,7,42,7.1,31],['Q',7,20,4.4,6]];
      for(const sign of [-1,1])volume(K,ivory,fin,{y,z:0,depth:15,bevel:.75,sign});
      K.both(navy,lathe([[6,y+6],[7,y+15],[5.1,y+40]],32));
      K.both(metal('#ef7437','copper'),T(new THREE.TorusGeometry(10,1.4,10,56),[0,y+34,0],[0,Math.PI/2,0]));
      K.both(navy,T(new THREE.CylinderGeometry(8.8,8.8,1.8,40),[0,y+34,0],[0,0,Math.PI/2]));
      for(const sign of [-1,1]){
        symbol(K,sign*15,y+12,8.3,1.2,seam);
        seams(K,seam,[[[sign*5,68],[sign*9,49],[sign*14,28]],[[sign*10,40],[sign*15,39]],[[sign*12,27],[sign*18,26]]],8.3,y);
      }
      // Large radial elbows leave the OUTSIDE of the enlarged drum, then sink
      // into the sampled sand. The front pair leaves the doorway approach open.
      for(const sign of [-1,1])for(const angle of [.4,.8,1.25,1.8,2.4]){
        const a=sign*angle, sx=Math.sin(a), sz=Math.cos(a), rim=R+6;
        const end=K.world(sx*(rim+14),0,sz*(rim+14));
        const sand=ground?K.local(V(end.x,ground(end.x,end.z),end.z)).y:y-2;
        const points=[[sx*(rim-.5),y+4.4,sz*(rim-.5)],[sx*(rim+3),y+4.4,sz*(rim+3)],
          [sx*(rim+8),y+1.5,sz*(rim+8)],[sx*(rim+14),Math.min(y-3,sand-2.5),sz*(rim+14)]];
        K.both(rust,tube(points,1.05,20,8));
        const q=new THREE.Quaternion().setFromUnitVectors(V(0,1,0),V(sx,0,sz));
        K.both(rust,new THREE.CylinderGeometry(1.5,1.5,.8,16).applyQuaternion(q).translate(sx*(rim+.6),y+4.4,sz*(rim+.6)));
      }
      for(let i=0;i<32;i++){const a=i*TAU/32;K.add(navy,disc(.16,.08,[Math.sin(a)*(R+1.1),y+4.8,Math.cos(a)*(R+1.1)]));}
      arch(entrance,rust,{w:15,h:19,dw:4.4,dh:11,y,z:R+2,depth:4});
      return y+74;
    }
    case 'spheres': {
      const green=stone('#b4cbb4',{course:4.5,width:7,wear:.2}), amber=glass??glazing('#edc478',V(0,y+35,2));
      // Rounded roots spread beneath the wings and continue below the meadow;
      // their height falls towards the tips, like the low lobes in the drawing.
      for(const sign of [-1,1])for(const [x,rx,h,rz,z] of [[14,13,11,15,2],[26,12,6.5,14,4],[37,10,4,11,3]]){
        K.both(ivory,new THREE.SphereGeometry(1,32,16).scale(rx,h+3,rz).translate(sign*x,y-3,z));
      }
      const prong=[['M',6,6],['L',16,6],['Q',10,12,9,27],['L',8.1,55],['Q',7.5,58,6.8,55],['L',6,6]];
      for(const sign of [-1,1])volume(K,green,prong,{y,sign,depth:9,bevel:.5});
      volume(K,green,[['M',-14,7],['L',-10,7],['L',-10,51],['Q',-11,57,-12,53],['L',-14,7]],{y,z:-6,depth:4,bevel:.35});
      // The crescent is an inlaid turquoise pane, not a chunk cut out of the lens.
      volume(K,amber,[['M',-6.3,9],['L',6.3,9],['L',6.3,56],['C',6.3,66,-6.3,66,-6.3,56]],{y,z:2,depth:2.2,bevel:.6});
      volume(K,ceramic('#73c7b8'),[['M',6.5,42],['C',-8,37,-7,25,6.5,23],['C',-1,27,-1.5,36,6.5,42]],{y,z:3.88,depth:.06,bevel:0});
      K.add(ivory,tube([[-6.5,y+10,3.4],[-6.5,y+56,3.4],[-4.5,y+61,3.4],[0,y+63,3.4],[4.5,y+61,3.4],[6.5,y+56,3.4],[6.5,y+10,3.4]],.16));
      const wing=[['M',10,5],['L',48,7.5],['L',48,8.2],['Q',22,8,10,14]];
      for(const sign of [-1,1])volume(K,green,wing,{y,sign,depth:7,bevel:.3});
      // A broad domed heel grows up around the small human entrance.
      volume(entrance,ivory,[['M',-29,-3],['C',-27,9,-19,31,0,33],['C',19,31,27,9,29,-3],
        ['L',2.7,-3],['L',2.7,6.5],['Q',0,12.5,-2.7,6.5],['L',-2.7,-3]],{y,z:9,depth:18,bevel:.6});
      arch(entrance,ceramic('#73c7b8'),{w:13,h:17,dw:5.4,dh:9.5,y,z:R+.8,depth:1.2});
      symbol(entrance,0,y+24,R+.7,2.1,paint('#6eaaa3'));
      return y+64;
    }
    case 'bazaar': {
      const pink=stone('#efaa9e',{course:2.5,width:4.3,wear:.25}), seam=paint('#b17f81');
      volume(K,pink,[['M',-9.5,0],['L',-3,0],['L',-3,34],['L',-4.5,39],['L',-8.7,40]],{z:2.3,depth:7,bevel:.3});
      volume(K,pink,[['M',3,0],['L',10,0],['L',8,43],['L',4.2,44],['L',3,40]],{z:2.3,depth:7,bevel:.3});
      volume(K,pink,[['M',-8,0],['L',-3.1,0],['L',-3.1,5.5],['Q',0,12,3.1,5.5],['L',3.1,0],['L',8,0],['L',6.4,22],['L',-6.4,22]],{z:3.8,depth:4.7,bevel:.2});
      const footing=stone('#8298a6',{course:1.8,width:3.6,wear:.3});
      for(const sign of [-1,1])for(const [x,w,h,d,z]of [[8.7,4.2,14,9,5],[12.5,3.4,8.5,8,5.7],[15.2,2.2,4.5,7,6.2]]){
        K.both(footing,box(w,h,d,sign*x,h/2,z));
        K.both(footing,box(w+.4,.55,d+.4,sign*x,h+.25,z));
      }
      for(let i=0;i<3;i++)arch(entrance,footing,{w:14-i*2,h:16.2-i*1.6,dw:6.5-i*.6,dh:10.2-i*.7,y:.35,z:9-i*1.5,depth:.9});
      const bronze=metal('#b37c65','copper');
      K.both(bronze,T(lathe([[.01,-.4],[2,-.1],[4,.6],[6,1.9],[6,2.2],[4,.95],[2,.2],[.01,0]],48),[0,29,6],[Math.PI/2,0,0]));
      K.both(metal('#79594d','brass'),ring(6,.2,[0,29,8.2]));
      for(const a of [0,TAU/3,TAU*2/3])K.both(metal('#79594d','brass'),tube([[0,29,9],[Math.sin(a)*5.6,29+Math.cos(a)*5.6,8.3]],.14));
      symbol(K,0,18.3,6.4,1.15);
      for(const sign of [-1,1])for(const yy of [5,12,20,27,34])seams(K,seam,[[[sign*3.4,yy],[sign*8.8,yy+.6]],[[sign*6.2,yy],[sign*6.2,yy+4.5]]],6.2,0,.045);
      return 45;
    }
    case 'moonfoundry': {
      const blue=metal('#3b4969','iron'), copper=metal('#d78b57','copper');
      K.both(blue,new THREE.CylinderGeometry(15.5,17.5,21,48).scale(1,1,.56).translate(0,y+10.5,-1));
      K.both(copper,new THREE.CylinderGeometry(16.4,16.4,2.2,48).scale(1,1,.6).translate(0,y+22,-1));
      // The wide tuning-fork face has a rounded upper slot and a narrow furnace slot below.
      volume(K,ivory,[['M',-4.4,23],['L',4.4,23],['L',4.4,47],['Q',4.5,52,8,55],['L',8,81],['L',-8,81],['L',-8,55],['Q',-4.5,52,-4.4,47]],{y,z:1,depth:7,bevel:.4,holes:[slot(0,55,77,3.2),slot(0,24,51,2.5)]});
      volume(K,gold,[['M',-17,51],['C',-20,38,-15,25,0,24],['C',15,25,20,38,17,51],['C',17,35,9,31,0,30],['C',-9,31,-17,35,-17,51]],{y,z:2,depth:4,bevel:.55});
      for(const yy of [7,14])K.add(paint('#35445f'),T(annulus(15.6,15.65,.08,48),[0,y+yy,-1],[0,0,0],[1,1,.57]));
      arch(entrance,blue,{w:15,h:20,dw:7.4,dh:16,y,z:R+2,depth:2.8});
      // The existing crane hook still moves; its broad copper jib is now legible beside the mould.
      const holes=[18,24,30,36].map(x=>{const h=new THREE.Path();h.absarc(x,0,.8,0,TAU,true);return h;});
      volume(K,copper,[['M',10,-2],['L',40,-2],['L',40,2],['L',10,2]],{y:y+38,z:-1,depth:2,bevel:.2,holes});
      return y+82;
    }
    case 'spacecity': {
      const teal=metal('#28717c','iron'), panel=metal('#235564','iron');
      const leg=[['M',17,8],['L',24,8],['L',15,69],['L',6,69],['L',6,37]];
      for(const a of [0,TAU/3,2*TAU/3]){const g=new THREE.ExtrudeGeometry(outline(leg),{depth:9,bevelEnabled:true,bevelSize:.4,bevelThickness:.4,bevelSegments:2}).translate(0,y,-4.5).rotateY(a);K.both(teal,g);}
      K.both(teal,lathe([[2,y+31],[3,y+34],[6,y+36],[6.5,y+40],[7,y+68]],36));
      for(const h of [36,39,43])K.both(panel,T(new THREE.TorusGeometry(h===36?5.6:6.5,.22,6,40),[0,y+h,0],[Math.PI/2,0,0]));
      // Thin rigging outlines the silhouette against space and meets the enlarged apron.
      for(let i=0;i<6;i++){const a=i*TAU/6;K.both(panel,tube([[Math.sin(a)*9,y+64,Math.cos(a)*9],[Math.sin(a)*27,y+1,Math.cos(a)*27]],.09));}
      arch(entrance,ivory,{w:11,h:15,dw:4.8,dh:8,y,z:R+1.6,depth:2});
      return y+70;
    }
    case 'underwater': {
      const shell=pearl('#fff2d3'), red=pearl('#fa7356');
      // Scalloped whorls on the rounded nautilus, flowing into the mantle below.
      const whorl=new THREE.SphereGeometry(1,64,36),p=whorl.attributes.position;
      for(let i=0;i<p.count;i++){
        const x=p.getX(i),yy=p.getY(i),z=p.getZ(i),a=Math.atan2(yy,x);
        const f=1+.009*Math.sin(a*22+z*2.5)+.003*Math.sin(a*44);
        p.setXYZ(i,20+x*20*f,49+yy*25*f,-10+z*13*f);
      }
      whorl.computeVertexNormals();K.both(nacre('#fff2d3',K.world(20,49,-10)),whorl);
      const root=shellSweep([[-12,1,-10],[4,17,-11],[20,22,-12],[37,9,-12],[58,-1,-10]],[3,11,12,6,.2],[8,15,16,10,.5],{steps:64,sides:16,folds:24});
      K.both(shell,root.geometry);
      // A broad coral aperture, rounded all the way into its inner vault.
      const lip=shellSweep([[-31,-1,9],[-28,13,10],[-27,37,7],[-24,56,3],[-13,49,4],[4,37,5],[23,20,7],[35,-1,10]],
        [4,4.5,3.4,2,4.2,6.8,8,6],[8,11,12,5,13,16,17,9],{steps:128,sides:20,folds:38});
      K.both(red,lip.geometry);
      return 76;
    }
    default: throw new Error(`Unknown temple landmark ${id}`);
  } } finally { K.M = previousMaterials; }
}
