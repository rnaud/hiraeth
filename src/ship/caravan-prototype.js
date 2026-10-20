// A review-only model of the approved caravan concept. No production ship imports this module.
// Right-handed metres after ROOT_SCALE. Bow -X, porch +Z; components remain named for later bridge work.
import * as THREE from 'three';
import { CaravanDeployment, caravanStowPose } from './caravan-deployment.js';
import { makeMaterial } from '../materials.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export const CARAVAN = Object.freeze({ length: 40, humanHeight: 1.75, source: '/references/The Travellers Ship/redesign/rounded-caravan-a/approved-reference.png' });
export function createCaravanPrototype() {
  const root = new THREE.Group(); root.name = 'caravan-prototype';
  const parts = {};
  const C = { cream: '#e7d8b6', ivory: '#f1e4cb', lavender: '#a295ac', coral: '#da8c75', teal: '#7baca7', dark: '#374b50', metal: '#958d78', wood: '#aa8d6b', leaf: '#657e66', sand: '#dcb99d' };
  const mats = Object.fromEntries(Object.entries(C).map(([k, color]) => [k, makeMaterial({ color })]));
  const group = (name) => { const g = new THREE.Group(); g.name = name; root.add(g); parts[name] = g; return g; };
  const hull = group('hull'), cockpit = group('cockpit'), landing = group('landing-gear'), engines = group('engines'), porch = group('porch'), awning = group('awning'), roof = group('roof'), tank = group('water-tank'), plants = group('plants'), details = group('repairs');
  const entry=group('entry'), deck=group('porch-panel'), rails=group('porch-rail'), supports=group('porch-supports'), rampGroup=group('ramp'), furniture=group('porch-furniture'), laundry=group('laundry'), solar=group('solar-panel'),roofLadder=group('roof-ladder');
  porch.add(deck,rails,supports,rampGroup,furniture);
  const add = (g, geo, color, xyz, rot, edge = true) => { const m = new THREE.Mesh(geo, mats[color] ?? color); m.position.set(...xyz); if(rot)m.rotation.set(...rot); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const box = (g, size, xyz, color='cream', radius=.06, rot) => add(g, radius ? new RoundedBoxGeometry(...size, 3, radius) : new THREE.BoxGeometry(...size),color,xyz,rot);
  const cyl = (g,r,h,xyz,color='metal',rot) => add(g,new THREE.CylinderGeometry(r,r,h,20),color,xyz,rot);
  const sphere = (g,size,xyz,color) => {const m=add(g,new THREE.SphereGeometry(1,16,10),color,xyz,undefined,false);m.scale.set(...size);return m;};
  const rod = (g,a,b,r=.025,color='metal') => { const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),d=vb.clone().sub(va);const m=cyl(g,r,d.length(),va.add(vb).multiplyScalar(.5).toArray(),color);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m; };
  // Authored seams and the washing line remain physical strokes; the game's post pass supplies all silhouettes.
  const line = (g,points) => { const strokes=new THREE.Group();g.add(strokes);for(let i=1;i<points.length;i++)rod(strokes,points[i-1],points[i],.006,makeMaterial({color:'#4b5052',flat:true}));return strokes; };
  // One contiguous index range per paint colour, never one draw per surface quad.
  const batchPaint=geo=>{const old=geo.index.array,bins=[[],[],[]];for(const g of geo.groups)for(let i=g.start;i<g.start+g.count;i++)bins[g.materialIndex].push(old[i]);geo.clearGroups();let offset=0;const next=[];bins.forEach((bin,material)=>{next.push(...bin);geo.addGroup(offset,bin.length,material);offset+=bin.length;});geo.setIndex(next);};
  // A longitudinal capsule: curved bow, long inhabited barrel, and a tapered aft waist.
  // Bands are faces of the shell itself, so no flat boxes or floating repair strips flatten its outline.
  const profile=x=>x < -4.15 ? Math.sqrt(Math.max(0,1-((x+4.15)/2.4)**2)) : x > 2.5 ? 1-.36*((x-2.5)/4.0)**1.5 : 1;
  const sideZ=(x,y)=>2.55*profile(x)*Math.sqrt(Math.max(0,1-((y-3.35)/(2.2*profile(x)))**2));
  const vertices=[],indices=[],colors=[],nx=112,nr=56;
  for(let i=0;i<=nx;i++){const x=-6.55+13.05*i/nx,r=profile(x);for(let j=0;j<=nr;j++){const a=j/nr*Math.PI*2;vertices.push(x,3.35+2.2*r*Math.sin(a),2.55*r*Math.cos(a));}}
  const shell=new THREE.BufferGeometry();shell.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  for(let i=0;i<nx;i++)for(let j=0;j<nr;j++){const a=i*(nr+1)+j,x=-6.55+13.05*(i+.5)/nx,y=(vertices[a*3+1]+vertices[(a+1)*3+1])/2;const z=(vertices[a*3+2]+vertices[(a+1)*3+2])/2;if(z>0&&x> -1.13&&x<3.78&&y>1.87&&y<4.29)continue;const start=indices.length;indices.push(a,a+nr+2,a+1,a,a+nr+1,a+nr+2);const band=[[-4.25,.45],[.9,.7],[4.6,.5]].some(([c,w])=>Math.abs(x-c)<w);shell.addGroup(start,6,Math.abs(y-3.17)<.26?2:band?1:0);}
  shell.setIndex(indices);batchPaint(shell);shell.computeVertexNormals();const skin=add(hull,shell,mats.cream,[0,0,0]);skin.material=[mats.cream,mats.lavender,mats.coral];skin.name='rounded-capsule-shell';
  // Wrap the visor around the ellipsoidal bow, following the shell at both window edges.
  const windowMaterial=makeMaterial({color:C.dark,side:THREE.DoubleSide});
  const visor=[],vi=[],steps=36,vertical=10;
  const glassPoint=(a,y)=>{const ry=Math.sqrt(1-((y-3.35)/2.2)**2);return [-4.15-2.43*ry*Math.cos(a),y,2.58*ry*Math.sin(a)];};
  for(let i=0;i<=steps;i++)for(let j=0;j<=vertical;j++)visor.push(...glassPoint(-1.36+2.72*i/steps,3.58+.97*j/vertical));
  for(let i=0;i<steps;i++)for(let j=0;j<vertical;j++){const a=i*(vertical+1)+j;vi.push(a,a+vertical+1,a+vertical+2,a,a+vertical+2,a+1);}
  const vg=new THREE.BufferGeometry();vg.setAttribute('position',new THREE.Float32BufferAttribute(visor,3));vg.setIndex(vi);vg.computeVertexNormals();add(cockpit,vg,windowMaterial,[0,0,0]);
  for(const y of [3.58,4.55])for(let i=0;i<steps;i++)rod(cockpit,glassPoint(-1.36+2.72*i/steps,y),glassPoint(-1.36+2.72*(i+1)/steps,y),.035);
  for(let i=0;i<=steps;i+=6)for(let j=0;j<vertical;j++)rod(cockpit,glassPoint(-1.36+2.72*i/steps,3.58+.97*j/vertical),glassPoint(-1.36+2.72*i/steps,3.58+.97*(j+1)/vertical),.035);
  box(hull,[4.91,1.22,.10],[1.325,3.68,1.28],'cream',.025);
  box(hull,[1.23,1.20,.10],[-.515,2.47,1.28],'cream',.025);
  box(hull,[3.68,1.20,.08],[1.94,2.47,-.72],'dark',.025);
  const lockerShutter=box(hull,[3.68,1.20,.08],[1.94,2.47,1.34],'metal',.025);
  for(const x of [.10,3.78])rod(hull,[x,1.87,1.36],[x,3.08,1.36],.055,'metal');
  const threshold=[],ti=[];for(let i=0;i<=30;i++){const x=-1.13+4.91*i/30;threshold.push(x,1.87,1.28,x,1.87,sideZ(x,1.87)-.02);}for(let i=0;i<30;i++){const a=i*2;ti.push(a,a+3,a+2,a,a+1,a+3);}const tg=new THREE.BufferGeometry();tg.setAttribute('position',new THREE.Float32BufferAttribute(threshold,3));tg.setIndex(ti);tg.computeVertexNormals();add(hull,tg,mats.wood,[0,0,0]);
  // A rounded sealing lip overlaps the discretized shell cut and the moving hatch edge.
  const sealParts=new THREE.Group();hull.add(sealParts);const seal=(x,y)=>[x,y,sideZ(x,y)+.035];
  for(const x of [-1.13,3.78])for(let i=0;i<24;i++){const y=1.87+2.42*i/24;rod(sealParts,seal(x,y),seal(x,y+2.42/24),.095,Math.abs(y-3.17)<.26?'coral':'cream');}
  for(const y of [1.87,4.29])for(let i=0;i<40;i++){const x=-1.13+4.91*i/40;rod(sealParts,seal(x,y),seal(x+4.91/40,y),.095,Math.abs(x-.9)<.7?'lavender':'cream');}
  const sealBins=new Map();for(const m of [...sealParts.children]){m.updateMatrix();const g=m.geometry.clone().applyMatrix4(m.matrix);if(!sealBins.has(m.material))sealBins.set(m.material,[]);sealBins.get(m.material).push(g);sealParts.remove(m);m.geometry.dispose();}for(const [material,gs]of sealBins){add(sealParts,mergeGeometries(gs),material,[0,0,0]);gs.forEach(g=>g.dispose());}
  // Framed inset entry on the porch side, with a ramp that reaches the sand.
  box(entry,[1.08,2.15,.14],[-.45,2.9,1.36],'metal',.29);
  box(entry,[.89,1.98,.17],[-.45,2.9,1.44],'dark',.27);
  box(entry,[.23,1.85,.12],[-.02,2.9,1.55],'cream',.04);
  box(deck,[4.1,.17,1.75],[1.55,1.87,3.4],'wood',.04);
  for(let i=0;i<18;i++)line(deck,[[-.48+i*.23,1.962,2.57],[-.48+i*.23,1.962,4.26]]);
  const ramp=box(rampGroup,[1.15,.13,2.9],[-.45,1.0,5.14],'wood',.035,[.64,0,0]);
  for(let i=0;i<11;i++)box(rampGroup,[1.08,.04,.055],[-.45,1+(5.14-(4+i*.228))*Math.tan(.64)+.08,4.0+i*.228],'cream',.01,[.64,0,0]);
  for(const x of [.25,1.35,2.45,3.55])rod(rails,[x,1.9,4.2],[x,2.65,4.2],.025);
  rod(rails,[.25,2.65,4.2],[3.55,2.65,4.2],.034);
  for(const x of [.4,3.35]) {rod(supports,[x,1.87,3.9],[x,.3,3.9],.05);cyl(supports,.14,.1,[x,.12,3.9]);}
  // The panel's outside matches the hull when closed; the porch's wood is its inside.
  const hingeZ=sideZ(1.55,1.87),outer=[],oi=[],rows=24,cols=30;
  for(let i=0;i<=rows;i++){const h=i/rows*2.42;for(let j=0;j<=cols;j++){const x=-1.13+4.91*j/cols;outer.push(x,1.87-(sideZ(x,1.87+h)-hingeZ)-.045,hingeZ+h);}}
  for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const a=i*(cols+1)+j;oi.push(a,a+cols+2,a+cols+1,a,a+1,a+cols+2);}const og=new THREE.BufferGeometry();og.setAttribute('position',new THREE.Float32BufferAttribute(outer,3));og.setIndex(oi);og.computeVertexNormals();for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const x=-1.13+4.91*(j+.5)/cols,y=1.87+2.42*(i+.5)/rows;og.addGroup((i*cols+j)*6,6,Math.abs(y-3.17)<.26?2:Math.abs(x-.9)<.7?1:0);}batchPaint(og);const hatch=add(deck,og,mats.cream,[0,0,0]);hatch.name='flush-hull-hatch';hatch.material=[mats.cream,mats.lavender,mats.coral];
  box(deck,[4.91,.14,.68],[1.325,1.87,hingeZ+.34],'wood',.025);
  // The fixed cassette is integrated into the shell; all coloured canvas and poles retract inside it.
  box(hull,[5.15,.23,.22],[1.32,4.83,sideZ(1.32,4.83)],'cream',.10);
  // Alternating canvas strips, scalloped valance and two slender support poles.
  for(let i=0;i<10;i++) {
    const x=-1.12+i*.49;
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([x,4.93,2.48,x+.49,4.93,2.48,x+.49,4.0,4.7,x,4.0,4.7],3));geo.setIndex([0,2,1,0,3,2]);geo.computeVertexNormals();
    const fabric=makeMaterial({color:C[i%2?'teal':'coral'],side:THREE.DoubleSide});add(awning,geo,fabric,[0,0,0]);
    sphere(awning,[.245,.13,.035],[x+.245,3.99,4.71],i%2?'teal':'coral');
  }
  for(const x of [-1.13,3.78]) { rod(awning,[x,1.9,4.7],[x,4.03,4.7],.035); }
  rod(awning,[-1.13,4.0,4.7],[3.78,4.0,4.7],.035);
  // Small lived-in furniture: a folding table and mismatched chairs.
  cyl(furniture,.45,.06,[1.5,2.68,3.23],'wood');
  for(const dx of [-.25,.25])rod(furniture,[1.5-dx,1.96,3.0],[1.5+dx,2.64,3.43],.018);
  const chair=(x,z,color)=>{box(furniture,[.46,.06,.42],[x,2.25,z],color,.04);for(const dx of [-.18,.18])for(const dz of [-.16,.16])rod(furniture,[x+dx,1.96,z+dz],[x+dx,2.25,z+dz],.018,color);box(furniture,[.44,.52,.05],[x,2.53,z-.19],color,.1);};
  chair(.65,3.14,'teal');chair(2.35,3.08,'wood');
  cyl(furniture,.07,.13,[1.5,2.78,3.22],'coral');cyl(furniture,.09,.03,[1.78,2.73,3.25],'ivory');
  rod(awning,[1.6,4.7,3.0],[1.6,4.1,3.0],.012,'dark');add(awning,new THREE.ConeGeometry(.2,.12,20),'metal',[1.6,4.04,3.0]);sphere(awning,[.08,.07,.08],[1.6,3.98,3.0],'ivory');
  // External water tank, straps, tap and pipe back into the hull.
  cyl(tank,.54,1.45,[4.31,3.43,2.82],'teal');sphere(tank,[.54,.28,.54],[4.31,4.15,2.82],'teal');sphere(tank,[.54,.25,.54],[4.31,2.71,2.82],'teal');
  for(const y of [2.9,3.86])cyl(tank,.565,.055,[4.31,y,2.82],'metal');cyl(tank,.17,.08,[4.31,4.43,2.82],'metal');rod(tank,[4.31,2.55,2.82],[4.31,2.35,3.35],.04);rod(tank,[4.31,2.35,3.35],[4.62,2.35,3.35],.035);
  // Crates and distinct leaves, kept deterministic so review pictures and later ports agree.
  for(let n=0;n<3;n++){const x=2.28+n*.52;box(plants,[.47,.32,.43],[x,2.13,3.89],'wood',.025);for(const y of [2.03,2.17])line(plants,[[x-.22,y,4.11],[x+.22,y,4.11]]);for(let j=0;j<7;j++){const a=j*2.399+n;const end=[x+Math.sin(a)*.24,2.65+(j%3)*.13,3.89+Math.cos(a)*.19];rod(plants,[x,2.3,3.89],end,.012,'leaf');const leaf=sphere(plants,[.085,.21,.035],end,'leaf');leaf.rotation.z=Math.sin(a)*.7;}}
  // Four sturdy landing feet and exposed hydraulics.
  for(const x of [-4.9,4.8])for(const z of [-1.9,1.9]) {cyl(landing,.5,.12,[x,.12,z]);cyl(landing,.35,.11,[x,.23,z],'ivory');rod(landing,[x,.3,z],[x+.26,1.4,z*.8],.13);rod(landing,[x-.23,.28,z+.1],[x+.03,1.3,z*.8+.1],.045,'dark');box(landing,[.65,.22,.65],[x+.26,1.39,z*.8],'metal',.06);}
  for(const z of [-1.9,1.9])rod(landing,[5.06,1.39,z*.8],[4.8,2.1,z*.65],.16,'metal');
  // Two substantial rounded aft lobes, stacked diagonally like the selected capsule drawing.
  for(const [y,z,r] of [[3.0,1.25,1.36],[4.55,-.65,1.23]]) {
    cyl(engines,r,1.72,[6.22,y,z],'lavender',[0,0,Math.PI/2]);
    sphere(engines,[.85,r,r],[5.36,y,z],'cream');
    sphere(engines,[.65,r,r],[7.08,y,z],'lavender');
    for(const x of [5.45,6.4,7.42])cyl(engines,r*1.015,.16,[x,y,z],'cream',[0,0,Math.PI/2]);
    cyl(engines,r*.84,.09,[7.73,y,z],'dark',[0,0,Math.PI/2]);cyl(engines,r*.62,.1,[7.77,y,z],'metal',[0,0,Math.PI/2]);
    cyl(engines,r*.46,.08,[7.81,y,z],'dark',[0,0,Math.PI/2]);
    for(let j=0;j<14;j++){const a=j*Math.PI/7;rod(engines,[6.65,y+Math.sin(a)*r,z+Math.cos(a)*r],[7.34,y+Math.sin(a)*r,z+Math.cos(a)*r],.025);}
  }
  // Roof equipment, ladder, propped solar array, laundry and antennas.
  for(const x of [-4.6,-1.0,4.0]){cyl(roof,.53,.16,[x,5.56,0],'metal');cyl(roof,.4,.13,[x,5.7,0],'cream');}
  box(solar,[2.0,.12,1.5],[-1.8,6.17,-.4],'metal',.025,[0,0,.5]);
  box(solar,[1.89,.04,1.39],[-1.8,6.24,-.4],'lavender',.01,[0,0,.5]);
  const panel=new THREE.Group();panel.position.set(-1.8,6.27,-.4);panel.rotation.z=.5;solar.add(panel);
  for(let i=0;i<6;i++)for(let j=0;j<4;j++)box(panel,[.295,.015,.32],[-.77+i*.308,0,-.52+j*.345],'dark',0);
  const solarBrace=rod(solar,[-.95,5.5,-.4],[-.95,6.6,-.4],.035);
  for(const x of [2.8,3.28]){rod(roofLadder,[x,2.2,2.63],[x,5.9,2.63],.035);rod(roofLadder,[x,5.9,2.63],[x,5.9,2.1],.035);}
  for(let i=0;i<10;i++)rod(roofLadder,[2.8,2.3+i*.34,2.65],[3.28,2.3+i*.34,2.65],.026);
  for(const [x,h] of [[-3.8,1.5],[3.95,2.0],[6.5,1.8]])rod(x>3?laundry:roof,[x,5.38,-.8],[x,5.38+h,-.8],.018,'dark');
  line(laundry,[[3.95,7.38,-.8],[5.2,7.05,-.8],[6.5,7.18,-.8]]);
  box(laundry,[.55,.85,.025],[5.6,6.72,-.8],'coral',.02);box(laundry,[.42,.58,.028],[4.65,6.84,-.8],'ivory',.02);box(laundry,[.75,.2,.028],[4.65,7.04,-.8],'ivory',.02);
  // Quiet panel seams and repair plates rather than a uniform noisy texture.
  for(const z of [-2.57,2.57]) {
    for(const [x,y,w,h,col]of[[-3.1,4.6,.45,.48,'cream'],[-2.4,2.6,.7,.5,'lavender'],[1.0,4.05,.6,.32,'ivory'],[4.75,4.6,.4,.28,'metal'],[-3.8,1.95,.5,.25,'ivory']])box(details,[w,h,.025],[x,y,z],col,.015);
    for(let i=0;i<42;i++){const x=-4.1+(i%14)*.65,y=2.03+Math.floor(i/14)*1.48;if(z>0&&x>-.9&&x<3.9)continue;sphere(details,[.017,.017,.012],[x,y,z*1.008],'metal');}
    for(const x of [-3.5,-1.6,2.3,4.15])line(details,[[x,2.1,z],[x,2.7,z],[x+.12,2.7,z],[x+.12,3.0,z]]);
  }
  cyl(entry,.25,.08,[-1.3,2.8,2.85],'metal');sphere(entry,[.19,.16,.19],[-1.3,2.99,2.85],'ivory');
  details.updateMatrixWorld(true);
  details.traverse(o=>{if(!o.isMesh||Math.abs(o.position.z)<2.5)return;const inv=o.matrix.clone().invert(),v=new THREE.Vector3(),attr=o.geometry.attributes.position;for(let i=0;i<attr.count;i++){v.fromBufferAttribute(attr,i).applyMatrix4(o.matrix);v.z=Math.sign(v.z)*(sideZ(v.x,v.y)+.03);v.applyMatrix4(inv);attr.setXYZ(i,v.x,v.y,v.z);}attr.needsUpdate=true;o.geometry.computeVertexNormals();});
  // Hinges work in the model's original local units; the final scale and all landed positions stay unchanged.
  const pivot=(name,at,child,parent=root)=>{const p=new THREE.Group();p.name=name;p.position.set(...at);parent.add(p);root.updateMatrixWorld(true);p.attach(child);return p;};
  const deckHinge=pivot('porch-hinge',[0,1.87,hingeZ],deck,porch);
  deckHinge.attach(rails);deckHinge.attach(supports);deckHinge.attach(rampGroup);
  const railHinge=pivot('rail-hinge',[0,1.95,4.2],rails,porch);deckHinge.attach(railHinge);
  const supportSlide=pivot('support-slide',[0,1.87,0],supports,porch);deckHinge.attach(supportSlide);
  const rampSlide=pivot('ramp-slide',[-.45,1.87,4],rampGroup,porch);deckHinge.attach(rampSlide);
  const furnitureSlide=pivot('furniture-locker',[0,1.95,0],furniture,porch),plantSlide=pivot('plant-locker',[0,1.95,0],plants);
  const canopySlide=pivot('canopy-cassette',[0,4.93,2.48],awning),laundrySlide=pivot('laundry-locker',[0,5.5,0],laundry),solarHinge=pivot('solar-stow',[-1.8,5.6,-.4],solar);
  const bases=new Map([supportSlide,rampSlide,furnitureSlide,plantSlide,canopySlide,laundrySlide,solarHinge].map(p=>[p,p.position.clone()]));
  const deployment=new CaravanDeployment({applyAltitude:y=>{
    root.position.y=y;
    // Gear telescopes into its wells only after leaving the ground, and extends before touchdown.
    const retracted=THREE.MathUtils.clamp(y/4,0,1);landing.position.y=retracted*1.45;landing.visible=retracted<.99;
  },applyCamp:t=>{
    const p=caravanStowPose(t);
    roofLadder.scale.y=Math.max(.001,p.canopy);roofLadder.position.y=5.5*(1-p.canopy);roofLadder.visible=p.canopy>0;
    lockerShutter.position.y=2.47+1.22*THREE.MathUtils.smoothstep(t,.55,.65);
    entry.visible=p.deck>.98;solarBrace.visible=p.solar>.2;
    deckHinge.rotation.x=-(1-p.deck)*Math.PI/2;
    railHinge.rotation.x=-(1-p.rails)*Math.PI/2;rails.visible=p.deck>0;
    supports.visible=p.supports>0;supportSlide.scale.y=Math.max(.001,p.supports);
    // Nested stairs move bodily into the side locker; no flattening or floating tread stack.
    rampGroup.visible=p.ramp>0;rampSlide.position.copy(bases.get(rampSlide));rampSlide.position.z-=2.9*(1-p.ramp);rampSlide.position.y+=.55*(1-p.ramp);
    // Canvas rolls toward its cassette. Struts shorten along their own axes with the front bar.
    awning.visible=p.canopy>0;canopySlide.scale.set(1,Math.max(.001,p.canopy),Math.max(.001,p.canopy));
    for(const [slide,child]of[[furnitureSlide,furniture],[plantSlide,plants]]){slide.position.copy(bases.get(slide));slide.position.z-=2.8*(1-p.props);child.visible=t>.55;}
    laundrySlide.position.copy(bases.get(laundrySlide));laundrySlide.position.y-=2*(1-p.laundry);laundry.visible=p.laundry>0;
    solarHinge.rotation.z=-.5*(1-p.solar);solarHinge.position.y=5.6-.50*(1-p.solar);
  }});
  root.scale.set(40 / 14.4, 2.1, 2.3);root.userData={prototype:true,source:CARAVAN.source};
  return { root, parts, deployment, materials:mats, dispose(){const geos=new Set(), materials=new Set();root.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});geos.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());} };
}
