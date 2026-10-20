// A review-only model of the approved caravan concept. No production ship imports this module.
// Right-handed metres after ROOT_SCALE. Bow -X, porch +Z; components remain named for later bridge work.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export const CARAVAN = Object.freeze({ length: 40, humanHeight: 1.75, source: '/references/The Travellers Ship/redesign/caravan/sheet-1.jpg' });
export function createCaravanPrototype() {
  const root = new THREE.Group(); root.name = 'caravan-prototype';
  const parts = {};
  const C = { cream: '#e7d8b6', ivory: '#f1e4cb', lavender: '#a295ac', coral: '#da8c75', teal: '#7baca7', dark: '#374b50', metal: '#958d78', wood: '#aa8d6b', leaf: '#657e66', sand: '#dcb99d' };
  const mats = Object.fromEntries(Object.entries(C).map(([k, color]) => [k, new THREE.MeshStandardMaterial({ color, roughness: .95, metalness: 0, flatShading: false })]));
  const ink = new THREE.LineBasicMaterial({ color: '#4b5052', transparent: true, opacity: .62 });
  const group = (name) => { const g = new THREE.Group(); g.name = name; root.add(g); parts[name] = g; return g; };
  const hull = group('hull'), cockpit = group('cockpit'), landing = group('landing-gear'), engines = group('engines'), porch = group('porch'), awning = group('awning'), roof = group('roof'), tank = group('water-tank'), plants = group('plants'), details = group('repairs');
  const add = (g, geo, color, xyz, rot, edge = true) => { const m = new THREE.Mesh(geo, mats[color] ?? color); m.position.set(...xyz); if(rot)m.rotation.set(...rot); m.castShadow = m.receiveShadow = true; g.add(m); if(edge) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 28), ink)); return m; };
  const box = (g, size, xyz, color='cream', radius=.06, rot) => add(g, radius ? new RoundedBoxGeometry(...size, 3, radius) : new THREE.BoxGeometry(...size),color,xyz,rot);
  const cyl = (g,r,h,xyz,color='metal',rot) => add(g,new THREE.CylinderGeometry(r,r,h,20),color,xyz,rot);
  const sphere = (g,size,xyz,color) => {const m=add(g,new THREE.SphereGeometry(1,16,10),color,xyz,undefined,false);m.scale.set(...size);return m;};
  const rod = (g,a,b,r=.025,color='metal') => { const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),d=vb.clone().sub(va);const m=cyl(g,r,d.length(),va.add(vb).multiplyScalar(.5).toArray(),color);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m; };
  const line = (g,points) => { const m=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),ink); g.add(m); return m; };
  // Broad rounded caravan shell. Repeated bands follow the same rounded section; their quiet seams read as repairs.
  box(hull,[13,4.4,5.1],[0,3.35,0],'cream',1.1);
  for (const [x,w] of [[-4.35,.7],[.9,1.55],[4.7,.8]]) {
    const a=2.565,b=2.215,r=1.11,shape=new THREE.Shape();
    shape.moveTo(-a+r,-b);shape.lineTo(a-r,-b);shape.quadraticCurveTo(a,-b,a,-b+r);shape.lineTo(a,b-r);shape.quadraticCurveTo(a,b,a-r,b);shape.lineTo(-a+r,b);shape.quadraticCurveTo(-a,b,-a,b-r);shape.lineTo(-a,-b+r);shape.quadraticCurveTo(-a,-b,-a+r,-b);
    const geo=new THREE.ExtrudeGeometry(shape,{depth:w,bevelEnabled:false,curveSegments:10});
    add(hull,geo,'lavender',[x-w/2,3.35,0],[0,Math.PI/2,0]);
  }
  // Coral belt, individually paneled on both flanks and the bow.
  for(const z of [-2.559,2.559]) for(const [x,w]of[[-4.6,2.1],[-2.6,1.75],[.1,2.1],[2.7,2.7],[4.75,.9]]) box(hull,[w,.5,.028],[x,3.2,z],'coral',.025);
  box(hull,[.04,.48,2.9],[-6.54,3.2,0],'coral',.02);
  // Wide dark cockpit panes; large visor and narrow pillars make the bow instantly readable.
  const windowMaterial=mats.dark.clone();windowMaterial.side=THREE.DoubleSide;
  const pane=(path)=>{const vertices=[],indices=[];for(const [x,z] of path)vertices.push(x,3.53,z,x,4.5,z);for(let i=0;i<path.length-1;i++){const a=i*2;indices.push(a,a+2,a+3,a,a+3,a+1);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();add(cockpit,geo,windowMaterial,[0,0,0],undefined,false);for(const y of [3.53,4.5])for(let i=0;i<path.length-1;i++)rod(cockpit,[path[i][0],y,path[i][1]],[path[i+1][0],y,path[i+1][1]],.035);};
  pane([[-6.54,-1.45],[-6.54,1.45]]);
  for(const sign of [-1,1]){const path=[];for(let i=0;i<=12;i++){const a=i/12*Math.PI/2;path.push([-5.4-1.14*Math.cos(a),sign*(1.45+1.14*Math.sin(a))]);}path.push([-4.68,sign*2.59]);pane(path);for(const a of [Math.PI/4,Math.PI/2]){const x=-5.4-1.16*Math.cos(a),z=sign*(1.45+1.16*Math.sin(a));rod(cockpit,[x,3.53,z],[x,4.5,z],.035);}rod(cockpit,[-4.68,3.53,sign*2.6],[-4.68,4.5,sign*2.6],.035);}
  for(const z of [-.96,0,.96])rod(cockpit,[-6.57,3.53,z],[-6.57,4.5,z],.035);
  box(cockpit,[1.2,.16,4.7],[-6.12,4.74,0],'ivory',.15);
  for(const z of [-1.88,1.88])cyl(cockpit,.13,.08,[-6.25,3.16,z],'teal',[0,0,Math.PI/2]);
  // Framed inset entry on the porch side, with a ramp that reaches the sand.
  box(porch,[1.08,2.15,.14],[-.45,2.9,2.57],'metal',.29);
  box(porch,[.89,1.98,.17],[-.45,2.9,2.65],'dark',.27);
  box(porch,[.23,1.85,.12],[-.02,2.9,2.76],'cream',.04);
  box(porch,[4.1,.17,1.75],[1.55,1.87,3.4],'wood',.04);
  for(let i=0;i<18;i++)line(porch,[[-.48+i*.23,1.962,2.57],[-.48+i*.23,1.962,4.26]]);
  const ramp=box(porch,[1.15,.13,2.9],[-.45,1.0,5.14],'wood',.035,[.64,0,0]);
  for(let i=0;i<11;i++)box(porch,[1.08,.04,.055],[-.45,1+(5.14-(4+i*.228))*Math.tan(.64)+.08,4.0+i*.228],'cream',.01,[.64,0,0]);
  for(const x of [.25,1.35,2.45,3.55])rod(porch,[x,1.9,4.2],[x,2.65,4.2],.025);
  rod(porch,[.25,2.65,4.2],[3.55,2.65,4.2],.034);
  for(const x of [.4,3.35]) {rod(porch,[x,1.87,3.9],[x,.3,3.9],.05);cyl(porch,.14,.1,[x,.12,3.9]);}
  // Alternating canvas strips, scalloped valance and two slender support poles.
  for(let i=0;i<10;i++) {
    const x=-1.12+i*.49;
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([x,4.93,2.48,x+.49,4.93,2.48,x+.49,4.0,4.7,x,4.0,4.7],3));geo.setIndex([0,2,1,0,3,2]);geo.computeVertexNormals();
    const fabric=mats[i%2?'teal':'coral'].clone();fabric.side=THREE.DoubleSide;add(awning,geo,fabric,[0,0,0]);
    sphere(awning,[.245,.13,.035],[x+.245,3.99,4.71],i%2?'teal':'coral');
  }
  for(const x of [-1.13,3.78]) { rod(awning,[x,1.9,4.7],[x,4.03,4.7],.035);cyl(awning,.07,4.94,[1.32,4.96,2.48],'metal',[0,0,Math.PI/2]); }
  rod(awning,[-1.13,4.0,4.7],[3.78,4.0,4.7],.035);
  // Small lived-in furniture: a folding table and mismatched chairs.
  cyl(porch,.45,.06,[1.5,2.68,3.23],'wood');
  for(const dx of [-.25,.25])rod(porch,[1.5-dx,1.96,3.0],[1.5+dx,2.64,3.43],.018);
  const chair=(x,z,color)=>{box(porch,[.46,.06,.42],[x,2.25,z],color,.04);for(const dx of [-.18,.18])for(const dz of [-.16,.16])rod(porch,[x+dx,1.96,z+dz],[x+dx,2.25,z+dz],.018,color);box(porch,[.44,.52,.05],[x,2.53,z-.19],color,.1);};
  chair(.65,3.14,'teal');chair(2.35,3.08,'wood');
  cyl(porch,.07,.13,[1.5,2.78,3.22],'coral');cyl(porch,.09,.03,[1.78,2.73,3.25],'ivory');
  rod(awning,[1.6,4.7,3.0],[1.6,4.1,3.0],.012,'dark');add(awning,new THREE.ConeGeometry(.2,.12,20),'metal',[1.6,4.04,3.0]);sphere(awning,[.08,.07,.08],[1.6,3.98,3.0],'ivory');
  // External water tank, straps, tap and pipe back into the hull.
  cyl(tank,.54,1.45,[4.31,3.43,2.82],'teal');sphere(tank,[.54,.28,.54],[4.31,4.15,2.82],'teal');sphere(tank,[.54,.25,.54],[4.31,2.71,2.82],'teal');
  for(const y of [2.9,3.86])cyl(tank,.565,.055,[4.31,y,2.82],'metal');cyl(tank,.17,.08,[4.31,4.43,2.82],'metal');rod(tank,[4.31,2.55,2.82],[4.31,2.35,3.35],.04);rod(tank,[4.31,2.35,3.35],[4.62,2.35,3.35],.035);
  // Crates and distinct leaves, kept deterministic so review pictures and later ports agree.
  for(let n=0;n<3;n++){const x=2.28+n*.52;box(plants,[.47,.32,.43],[x,2.13,3.89],'wood',.025);for(const y of [2.03,2.17])line(plants,[[x-.22,y,4.11],[x+.22,y,4.11]]);for(let j=0;j<7;j++){const a=j*2.399+n;const end=[x+Math.sin(a)*.24,2.65+(j%3)*.13,3.89+Math.cos(a)*.19];rod(plants,[x,2.3,3.89],end,.012,'leaf');const leaf=sphere(plants,[.085,.21,.035],end,'leaf');leaf.rotation.z=Math.sin(a)*.7;}}
  // Four sturdy landing feet and exposed hydraulics.
  for(const x of [-4.9,4.8])for(const z of [-1.9,1.9]) {cyl(landing,.5,.12,[x,.12,z]);cyl(landing,.35,.11,[x,.23,z],'ivory');rod(landing,[x,.3,z],[x+.26,1.4,z*.8],.13);rod(landing,[x-.23,.28,z+.1],[x+.03,1.3,z*.8+.1],.045,'dark');box(landing,[.65,.22,.65],[x+.26,1.39,z*.8],'metal',.06);}
  // Twin barrel engines with layered throat, rings, ribs and restrained dark exhaust.
  for(const z of [-1.7,1.7]) {
    cyl(engines,.99,2.75,[6.28,3.22,z],'lavender',[0,0,Math.PI/2]);
    for(const x of [5.08,6.45,7.52])cyl(engines,1.025,.19,[x,3.22,z],'cream',[0,0,Math.PI/2]);
    cyl(engines,.84,.08,[7.69,3.22,z],'dark',[0,0,Math.PI/2]);cyl(engines,.52,.1,[7.75,3.22,z],'metal',[0,0,Math.PI/2]);cyl(engines,.36,.12,[7.82,3.22,z],'dark',[0,0,Math.PI/2]);
    for(let j=0;j<12;j++){const a=j*Math.PI/6;rod(engines,[5.22,3.22+Math.sin(a)*1.0,z+Math.cos(a)*1.0],[5.95,3.22+Math.sin(a)*1.0,z+Math.cos(a)*1.0],.025);}
  }
  // Roof equipment, ladder, propped solar array, laundry and antennas.
  for(const x of [-4.6,-1.0,4.0]){cyl(roof,.53,.16,[x,5.56,0],'metal');cyl(roof,.4,.13,[x,5.7,0],'cream');}
  box(roof,[2.0,.12,1.5],[-1.8,6.17,-.4],'metal',.025,[0,0,.5]);
  box(roof,[1.89,.04,1.39],[-1.8,6.24,-.4],'lavender',.01,[0,0,.5]);
  const panel=new THREE.Group();panel.position.set(-1.8,6.27,-.4);panel.rotation.z=.5;roof.add(panel);
  for(let i=0;i<6;i++)for(let j=0;j<4;j++)box(panel,[.295,.015,.32],[-.77+i*.308,0,-.52+j*.345],'dark',0);
  rod(roof,[-.95,5.5,-.4],[-.95,6.6,-.4],.035);
  for(const x of [2.8,3.28]){rod(roof,[x,2.2,2.63],[x,5.9,2.63],.035);rod(roof,[x,5.9,2.63],[x,5.9,2.1],.035);}
  for(let i=0;i<10;i++)rod(roof,[2.8,2.3+i*.34,2.65],[3.28,2.3+i*.34,2.65],.026);
  for(const [x,h] of [[-3.8,1.5],[3.95,2.0],[6.5,1.8]])rod(roof,[x,5.38,-.8],[x,5.38+h,-.8],.018,'dark');
  line(roof,[[3.95,7.38,-.8],[5.2,7.05,-.8],[6.5,7.18,-.8]]);
  box(roof,[.55,.85,.025],[5.6,6.72,-.8],'coral',.02);box(roof,[.42,.58,.028],[4.65,6.84,-.8],'ivory',.02);box(roof,[.75,.2,.028],[4.65,7.04,-.8],'ivory',.02);
  // Quiet panel seams and repair plates rather than a uniform noisy texture.
  for(const z of [-2.57,2.57]) {
    for(const [x,y,w,h,col]of[[-3.1,4.6,.45,.48,'cream'],[-2.4,2.6,.7,.5,'lavender'],[1.0,4.05,.6,.32,'ivory'],[4.75,4.6,.4,.28,'metal'],[-3.8,1.95,.5,.25,'ivory']])box(details,[w,h,.025],[x,y,z],col,.015);
    for(let i=0;i<42;i++){const x=-4.1+(i%14)*.65,y=2.03+Math.floor(i/14)*1.48;if(z>0&&x>-.9&&x<3.9)continue;sphere(details,[.017,.017,.012],[x,y,z*1.008],'metal');}
    for(const x of [-3.5,-1.6,2.3,4.15])line(details,[[x,2.1,z],[x,2.7,z],[x+.12,2.7,z],[x+.12,3.0,z]]);
  }
  cyl(details,.25,.08,[-1.3,2.8,2.85],'metal');sphere(details,[.19,.16,.19],[-1.3,2.99,2.85],'ivory');
  root.scale.set(40 / 14.4, 1.8, 2.3);root.userData={prototype:true,source:CARAVAN.source};
  return { root, parts, materials:mats, dispose(){const geos=new Set(), materials=new Set();root.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)materials.add(o.material);});geos.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());} };
}
