import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, releaseMaterial } from '../materials.js';

let serial=0;
const UP=new T.Vector3(0,1,0), V=(a)=>new T.Vector3(...a);
/** Articulated reference silhouettes. All opaque surfaces use the game's ink/G-buffer material. */
export function enemyModel(s) {
  const group=new T.Group();group.name=s.name;
  const body=new T.Group();group.add(body);
  const mats=[];
  function material(color,glow=0,lineWhite=false){const m=makeMaterial({color,flat:false,hatch:.45,patches:0,side:T.DoubleSide,glow,lineWhite,key:`world-enemy.${serial++}`});mats.push(m);return m;}
  // No invisible foes (src/foe-presence.js): a spirit's ink, and the spirit inside a machine, are drawn with
  // white contours like the shades, and the eyes glow (≥ 0.5) so they read through the orange of a wind-up too.
  const spirit=s.family==='shade'||s.family==='machine';
  const skin=material(s.color),accent=material(s.accent),ink=material('#171321',0,spirit),violet=material('#76617d',0,spirit),cream=material('#eee2be'),brass=material('#b39464'),dark=material('#575653');
  const eye=material('#f8e8bb',.8), joint=s.family==='machine'?brass:skin;
  const limbs=[],wings=[],smoke=[],rotors=[];
  function mesh(g,m,p=[0,0,0],parent=body){const o=new T.Mesh(g,m);o.position.set(...p);parent.add(o);return o;}
  function ell(p,r,m=skin,parent=body){return mesh(new T.SphereGeometry(1,12,8).scale(...r),m,p,parent);}
  function box(p,r,m=skin,parent=body){return mesh(new T.BoxGeometry(...r),m,p,parent);}
  function cone(p,r,h,m=skin,parent=body){return mesh(new T.ConeGeometry(r,h,10),m,p,parent);}
  function beam(a,b,r,m=joint,parent=body,r2=r){const d=V(b).sub(V(a)),o=mesh(new T.CylinderGeometry(r2,r,d.length(),8),m,V(a).addScaledVector(d,.5).toArray(),parent);o.quaternion.setFromUnitVectors(UP,d.normalize());return o;}
  function ring(p,r,m=brass,parent=body,th=.035){return mesh(new T.TorusGeometry(r,th,6,24),m,p,parent);}
  function curve(points,r,m=joint,parent=body){return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(V)),Math.max(8,points.length*4),r,5,false),m,[0,0,0],parent);}
  function panel(points,m=skin,parent=body){const shape=new T.Shape();points.forEach((p,i)=>i?shape.lineTo(p[0],p[1]):shape.moveTo(p[0],p[1]));shape.closePath();return mesh(new T.ShapeGeometry(shape),m,[0,0,0],parent);}
  function eyes(p,spread=.13,parent=body){for(const side of [-1,1]){const x=p[0]+side*spread;ell([x,p[1],p[2]],[.03,.042,.025],eye,parent);if(s.slot<2)ell([x,p[1],p[2]+.022],[.016,.024,.01],ink,parent);}}
  function leg(at,knee,foot,r=.06,parent=body){
    const h=new T.Group();h.position.set(...at);parent.add(h);ell([0,0,0],[r*1.45,r*1.45,r*1.45],joint,h);
    beam([0,0,0],knee,r,joint,h);ell(knee,[r*1.55,r*1.55,r*1.55],joint,h);beam(knee,foot,r*.8,joint,h);ell([foot[0],foot[1],foot[2]+.06],[r*1.5,r*.8,r*2.6],joint,h);limbs.push({o:h,role:'leg',side:Math.sign(at[0])||1});return h;
  }
  function arm(at,side,length=1,claw=true,parent=body){
    const h=new T.Group();h.position.set(...at);parent.add(h);const r=s.family==='machine'?.095:.055;
    ell([0,0,0],[r*1.6,r*1.6,r*1.6],joint,h);beam([0,0,0],[side*.12,-length*.48,.02],r,joint,h);ell([side*.12,-length*.48,.02],[r*1.4,r*1.4,r*1.4],joint,h);beam([side*.12,-length*.48,.02],[side*.17,-length,.1],r*.75,joint,h);
    if(claw)for(let i=-1;i<=1;i++)curve([[side*.17,-length,.1],[side*.17+i*.08,-length-.13,.17],[side*.17+i*.07,-length-.27,.26]],r*.3,joint,h);
    limbs.push({o:h,role:'arm',side});return h;
  }
  function antenna(at,height= .5,parent=body){curve([at,[at[0]+.05,at[1]+height*.6,at[2]],[at[0]+.15,at[1]+height,at[2]+.08]],.016,brass,parent);}
  function branches(at,parent=body){for(let i=0;i<3;i++){const b=[at[0]+(i-1)*.17,at[1]+.25+i*.09,at[2]];beam(at,b,.025,accent,parent);beam(b,[b[0]+.12,b[1]+.16,b[2]+.02],.014,accent,parent);}}
  function shellSeams(y,rx,ry,rz,parent=body){
    for(let i=0;i<4;i++){const latitude=-.8+i*.52,rr=Math.cos(latitude),points=[];
      for(let j=0;j<=10;j++){const a=-1.25+j*.25;points.push([Math.sin(a)*rx*rr,y+Math.sin(latitude)*ry,Math.cos(a)*rz*rr+.004]);}
      curve(points,.006,dark,parent);
    }
  }
  function corruption(at,parent=body){
    // The spirit visibly enters the hull; solid dark lobes overlap the opening.
    for(let i=0;i<7;i++)ell([at[0]+Math.sin(i*2.4)*.18,at[1]+i*.045,at[2]],[.18+(i%3)*.035,.17,.12],ink,parent);
    eyes([at[0],at[1]+.12,at[2]+.13],.09,parent);
    for(let i=0;i<4;i++){const p=new T.Group();p.position.set(at[0]+i*.08,at[1]+.15,at[2]-.04);parent.add(p);
      const o=curve([[0,0,0],[.14,.28,.03],[-.05,.52,0],[.2,.75,.04],[.11,1.02,0]],.07-i*.008,i%2?violet:ink,p);smoke.push(p);
      for(let j=0;j<3;j++)ell([.11+Math.sin(j*3+i)*.065,.45+j*.22,.02],[.13-j*.025,.12-j*.02,.1-j*.02],i%2?violet:ink,p);
    }
    for(let i=0;i<4;i++)cone([at[0]-.18+i*.12,at[1]-.32-i*.04,at[2]],.045,.65+i*.12,ink,parent).rotation.z=Math.PI;
  }
  const form=s.form;
  if(s.family==='machine') {
    const tripod=form==='tripod', bell=form==='bell', bowl=form==='crucible', diver=form==='diver', wide=form==='drawing';
    const bottom=tripod?1.25:1.05, cy=bottom+.66;
    if(bell){const points=[[.48,0],[.64,.06],[.5,.18],[.36,.75],[.29,1.28],[.22,1.35]].map(([x,y])=>new T.Vector2(x,y));mesh(new T.LatheGeometry(points,20),cream,[0,bottom,0]);ring([0,bottom+1.46,0],.12,brass);}
    else if(bowl) {mesh(new T.SphereGeometry(.66,18,10,0,Math.PI*2,Math.PI/2,Math.PI/2),cream,[0,bottom+1.02,0]);ring([0,bottom+1.03,0],.66,brass).rotation.x=Math.PI/2;ell([0,bottom+.9,0],[.5,.2,.5],ink);}
    else {ell([0,cy,0],[diver?.69:wide?.59:.47,diver?.78:.73,diver?.55:.37],cream);mesh(new T.CylinderGeometry(diver?.57:.44,diver?.57:.44,.12,16),brass,[0,bottom+.08,0]);}
    // Plate seams, fasteners and a central panel establish an old service machine.
    for(const y of [bottom+.18,bottom+.8]){const q=ring([0,y,0],diver?.59:.45,brass);q.rotation.x=Math.PI/2;q.scale.z=.82;}
    box([0,cy,.36],[.32,.48,.035],skin);for(const x of [-.15,.15])for(const y of [-.2,.2])ell([x,cy+y,.39],[.028,.028,.018],brass);
    const n=tripod||bell?3:2;
    for(let i=0;i<n;i++){const x=n===2?(i?1:-1)*.3:Math.sin(i*2*Math.PI/3)*.42,z=n===2?0:Math.cos(i*2*Math.PI/3)*.4;const side=Math.sign(x)||1;leg([x,bottom+.08,z],[side*.13,-bottom*.48,.06],[side*.22,-bottom,.18],diver?.13:.07);}
    if(!tripod&&!bell)for(const side of [-1,1])arm([side*.48,cy+.18,0],side,diver?.8:1.04,true);
    const top=bottom+1.38;
    if(['roof','pack'].includes(s.detail)){cone([0,top+.1,0],.49,.25,brass);ell([0,top+.25,0],[.055,.055,.055],brass);}
    if(['dish','halo'].includes(s.detail)){beam([0,top,0],[0,top+.3,0],.06,brass);const rotor=new T.Group();rotor.position.y=top+.36;body.add(rotor);const q=ring([0,0,0],.65,cream,rotor,.08);if(s.detail==='dish'){q.rotation.x=Math.PI/2;ell([0,0,0],[.63,.08,.63],cream,rotor);}rotors.push(rotor);}
    if(s.detail==='lens'||s.detail==='portholes') {ring([0,cy+.25,.4],.19,brass);ell([0,cy+.25,.41],[.16,.16,.055],ink);eyes([0,cy+.25,.47],.065);if(diver)for(const side of [-1,1])ring([side*.52,cy,.29],.12,brass);}
    if(['spout','nozzle','chimney','pen'].includes(s.detail)||form==='pump'||form==='welder'){
      const pipe=new T.Group();pipe.position.set(0,cy+.45,.28);body.add(pipe);beam([0,0,0],[0,.07,.66],.11,brass,pipe);ring([0,.07,.68],.13,brass,pipe);ell([0,.07,.68],[.08,.08,.015],ink,pipe);limbs.push({o:pipe,role:'nozzle',side:1});}
    if(['saw','drill'].includes(s.detail)){const tool=new T.Group();tool.position.set(.57,cy-.1,.12);body.add(tool);if(s.detail==='saw'){const r=ring([0,-.2,.1],.28,dark,tool,.08);rotors.push(r);for(let i=0;i<10;i++)cone([Math.sin(i*Math.PI/5)*.28,-.2+Math.cos(i*Math.PI/5)*.28,.1],.06,.12,brass,tool).rotation.z=-i*Math.PI/5;}else{cone([0,-.28,.05],.18,.7,brass,tool).rotation.z=Math.PI;}limbs.push({o:tool,role:'arm',side:1});}
    if(s.detail==='spool'||s.detail==='hook') {beam([.35,cy,0],[.5,top+.48,0],.045,brass);beam([.5,top+.48,0],[.85,top+.48,.1],.045,brass);curve([[.85,top+.48,.1],[.85,cy-.2,.1],[.77,cy-.4,.1],[.66,cy-.28,.1]],.028,dark);if(s.detail==='spool'){const q=ring([.35,top,.1],.24,dark);rotors.push(q);}}
    if(s.detail==='leaves')for(const side of [-1,1])ell([side*.42,top-.25,.05],[.22,.1,.26],accent).rotation.z=side*.5;
    if(form==='sign')box([0,cy+.1,.43],[.6,.82,.05],cream);
    if(form==='watering'){curve([[0,cy,0],[-.72,cy+.18,0],[-.8,cy-.25,0],[-.4,cy-.3,0]],.04,brass);cone([0,top+.12,0],.21,.25,brass);}
    if(form==='drawing')for(let i=0;i<3;i++)beam([-.2+i*.18,cy-.4,.37],[-.25+i*.2,cy-.6,.63],.035,brass);
    corruption([-.25,cy+.13,.37]);
  } else if(s.family==='shade') {
    const cy=1.8, headY=2.65;
    ell([0,cy,0],[.29,.5,.16],ink);ell([0,headY,0],[s.detail==='oval'?.18:.21,.27,.17],ink);beam([0,2.1,0],[0,headY,0],.065,ink);
    for(const side of [-1,1]) {leg([side*.15,1.38,0],[side*.025,-.66,.035],[side*.055,-1.34,.11],.035);arm([side*.31,2.09,0],side,1.35,true);}
    eyes([0,headY,.16],.075);
    if(form!=='bare'){
      const cloak=new T.Group();cloak.position.set(0,2.58,-.05);body.add(cloak);
      const len=['coat','suit','quilt'].includes(form)?1.75:1.2;
      const vertices=[],indices=[],n=16;
      for(let row=0;row<3;row++)for(let i=0;i<=n;i++){
        const a=i/n*Math.PI*2,radius=[.16,.42,.3][row];
        vertices.push(Math.sin(a)*radius, row===0?0:row===1?-.28:-len-(i%3)*.12, Math.cos(a)*radius*.7);
      }
      for(let row=0;row<2;row++)for(let i=0;i<n;i++){const a=row*(n+1)+i,b=a+n+1;indices.push(a,b,a+1,a+1,b,b+1);}
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();mesh(g,ink,[0,0,0],cloak);
      for(let i=0;i<7;i++){const a=i/7*Math.PI*2;const strip=panel([[-.14,0],[.14,.03],[.18,-len*.6],[.06,-len-.15*(i%3)],[-.13,-len*.83]],i%3===0?violet:ink,cloak);strip.position.set(Math.sin(a)*.25,-.19,Math.cos(a)*.2);strip.rotation.y=a;smoke.push(strip);}
      if(['monk','feather','cape'].includes(form))cone([0,2.81,-.04],.26,.57,ink);
      if(form==='feather')for(const side of [-1,1])for(let i=0;i<4;i++)ell([side*(.18+i*.07),2.57-i*.1,-.08],[.13,.28,.045],violet).rotation.z=side*(.55+i*.1);
      if(form==='quilt')for(let i=0;i<4;i++)curve([[-.28,2.3-i*.22,.14],[0,2.1-i*.22,.24],[.28,2.3-i*.22,.14]],.015,violet);
    }
    if(['brim','hat'].includes(s.detail)){ell([0,2.77,0],[.48,.035,.3],ink);if(s.detail==='hat')mesh(new T.CylinderGeometry(.17,.2,.25,12),ink,[0,2.91,0]);}
    if(s.detail==='helmet'){ell([0,2.65,-.04],[.3,.34,.26],violet);ell([0,2.65,.2],[.225,.26,.06],ink);eyes([0,2.66,.265],.08);ring([0,2.65,.23],.26,dark);}
    if(form==='antlers')for(const side of [-1,1]){curve([[side*.14,2.8,0],[side*.38,3.05,0],[side*.5,3.32,.02]],.025,ink);for(let i=0;i<3;i++)beam([side*(.22+i*.1),2.89+i*.14,0],[side*(.48+i*.1),3.07+i*.13,.03],.015,ink);}
    if(form==='halo')ring([0,2.65,-.16],.44,violet);
    if(form==='parcel'){box([0,2.08,-.32],[.7,.65,.27],violet);beam([-.36,1.78,-.49],[.36,2.4,-.49],.02,ink);}
    if(form==='sailor')for(let i=0;i<3;i++)curve([[-.28,2.3-i*.15,.15],[0,2.15-i*.15,.25],[.3,2.28-i*.15,.15]],.025,violet);
    if(s.detail==='cables')for(const side of [-1,1])curve([[side*.2,2.55,-.1],[side*.5,2.8,-.2],[side*.6,.3,-.2],[side*.2,.04,-.1]],.016,ink);
    if(form==='paper')for(let i=0;i<5;i++){const p=panel([[-.2,0],[.23,.1],[.14,-.35],[-.28,-.25]],violet);p.position.set((i%2?1:-1)*.3,2.1-i*.2,-.1);p.rotation.y=i*.8;}
    for(let i=0;i<4;i++){const q=curve([[.05,1.6,-.15],[.35+i*.04,1.1,-.1],[.12,.65,-.1],[.34,.35,-.05]],.035,violet);smoke.push(q);}
  } else if(['crab','mantis','grub','shell','pearl'].includes(form)) {
    const tall=s.detail==='tall'||form==='mantis',y=tall?1.22:.68;
    if(form==='pearl'){ell([0,.95,0],[.8,.82,.48],skin);const q=ring([0,.95,.46],.58,accent);q.scale.set(.8,1,1);curve([[0,.95,.5],[.1,1.08,.5],[-.14,1.15,.5],[-.24,.89,.5],[.1,.63,.5]],.02,dark);}
    else if(form==='shell'){ell([0,.96,0],[.54,.93,.48],skin);cone([0,1.8,-.04],.29,.55,skin);shellSeams(.95,.56,.8,.49);}
    else if(form==='grub'){for(let i=0;i<5;i++)ell([0,y+.08*i,.58-i*.3],[.42+i*.025,.34,.29],i%2?accent:skin);if(s.detail==='drill')for(let i=0;i<6;i++)cone([0,.33-i*.085,.58],.22-i*.03,.18,accent).rotation.z=Math.PI;}
    else{ell([0,y+.22,0],[.62,tall?.8:.4,.48],skin);shellSeams(y+.22,.63,tall?.75:.38,.49);}
    for(let i=0;i<3;i++)for(const side of [-1,1]){const z=-.38+i*.36;leg([side*.4,y,z],[side*.34,-.14,.08],[side*(tall?.4:.65),-y+.06,.1],form==='mantis'?.065:.07);}
    if(form==='crab'||form==='mantis')for(const side of [-1,1]){const a=arm([side*.52,y+.1,.25],side,.35,false);ell([side*.2,-.4,.24],[.18,.25,.14],skin,a);for(const k of [-1,1])cone([side*.2+k*.1,-.64,.25],.08,.34,skin,a).rotation.z=Math.PI+k*.3;}
    eyes([0,y+.13,.48],.16);
    if(['coral','rock','crystal','hooks'].includes(s.detail))for(let i=0;i<5;i++) {const p=[(i-2)*.15,y+.55+(i%2)*.16,-.16];if(s.detail==='coral')branches(p);else cone(p,.12,.36,accent).rotation.z=(i-2)*.25;}
  } else if(['ray','moth','wasp'].includes(form)) {
    ell([0,.55,0],[form==='ray'?.34:.17,form==='ray'?.15:.42,.48],skin);
    ell([0,.63,.39],[.16,.16,.19],skin);eyes([0,.68,.55],.1);
    for(const side of [-1,1]){
      const hinge=new T.Group();hinge.position.set(side*.18,.6,0);body.add(hinge);
      const pts=form==='ray'?[[0,.15],[side*1.35,.25],[side*.9,-.46],[side*.2,-.65],[0,-.35]]:[[0,.1],[side*.9,.55],[side*1.05,-.35],[side*.65,-.82],[0,-.35]];
      const wing=panel(pts,skin,hinge);wing.rotation.x=-Math.PI*.3;wings.push({o:hinge,side});
      for(let i=1;i<4;i++)beam([0,0,0],[side*(.3+i*.22),.008,.15+i*.12],.01,dark,hinge);
      if(form==='wasp') {const rear=panel([[0,0],[side*.68,-.1],[side*.4,-.5],[0,-.3]],accent,hinge);rear.rotation.x=-Math.PI*.3;rear.position.z=-.3;}
      if(s.detail==='longwings')hinge.scale.z=1.45;
    }
    curve([[0,.55,-.4],[0,.43,-.9],[.12,.1,-1.4],[.3,.05,-1.7]],.025,skin);
    if(form==='wasp')for(const side of [-1,1])leg([side*.11,.35,0],[side*.08,-.38,.04],[side*.15,-.8,.1],.025);
    if(form!=='ray')for(const side of [-1,1])antenna([side*.09,.74,.36],.35);
    if(['spikes','spines','crystal'].includes(s.detail))for(let i=0;i<4;i++)cone([0,.69,-.38+i*.19],.04,.23,accent);
    if(s.detail==='ribbons')for(const side of [-1,1])curve([[side*.18,.5,-.3],[side*.6,.35,-.8],[side*.45,.1,-1.4],[side*.75,.3,-1.7]],.035,skin);
    if(s.detail==='lantern'){beam([0,.42,.1],[0,-.03,.1],.016,dark);ell([0,-.16,.1],[.14,.2,.13],eye);}
  } else if(['bird','urn','stalker','scalebird','seedpod','lanterncap','rootcap','cloud'].includes(form)) {
    const short=form==='rootcap',y=short?.68:1.2;
    ell([0,y,0],[form==='urn'?.4:.3,form==='rootcap'?.62:.5,.3],skin);
    for(const side of [-1,1])leg([side*.15,y-.3,0],[side*.02,-(y-.3)*.5,.04],[side*.06,-(y-.3)+.025,.13],.035);
    if(form==='bird'||form==='urn'||form==='stalker'){
      curve([[0,y+.25,0],[0,y+.63,.04],[0,y+1,.13],[0,y+1.15,.32]],.075,skin);ell([0,y+1.14,.3],[.19,.11,.3],skin);beam([0,y+1.12,.42],[0,y+1.06,.94],.08,skin,body,.005);eyes([0,y+1.17,.53],.12);
      if(form==='stalker')for(const side of [-1,1])arm([side*.22,y+.8,0],side,.75);
      else for(const side of [-1,1])ell([side*.27,y,-.05],[.09,.48,.24],accent).rotation.z=side*.18;
    } else if(form==='lanterncap'||form==='rootcap'){
      if(form==='lanterncap')beam([0,y,0],[0,2.1,0],.075,skin);
      const top=form==='lanterncap'?2.1:1.35;ell([0,top,0],[.63,.16,.48],skin);cone([0,top+.12,0],.57,.3,skin);eyes([0,y+.13,.28],.11);
      if(form==='lanterncap')for(const side of [-1,1]){beam([side*.37,top,0],[side*.37,top-.33,0],.017,dark);ell([side*.37,top-.47,0],[.14,.2,.14],eye);}
      else for(let i=0;i<8;i++){const a=i*Math.PI/4;curve([[Math.sin(a)*.25,.5,Math.cos(a)*.2],[Math.sin(a)*.45,.15,Math.cos(a)*.4],[Math.sin(a)*.65,.04,Math.cos(a)*.6]],.035,skin);}
    } else if(form==='cloud') {for(let i=0;i<7;i++)ell([Math.sin(i*2.4)*.25,y+.45+i*.13,Math.cos(i*2.4)*.14],[.32,.3,.29],i%2?accent:skin);eyes([0,y,.28],.12);}
    else if(form==='seedpod'){ell([0,1.85,0],[.31,.53,.25],skin);cone([0,2.32,0],.22,.54,skin);for(const side of [-1,1]){curve([[0,1.1,0],[side*.4,1.2,.05],[side*.5,1.5,.1]],.025,skin);ell([side*.5,1.5,.1],[.1,.13,.1],accent);}eyes([0,1.72,.25],.1);}
    else {for(let row=0;row<4;row++)for(let i=0;i<5;i++){const a=i/5*Math.PI*2;ell([Math.sin(a)*.28,y+.5-row*.21,Math.cos(a)*.26],[.16,.24,.06],row%2?accent:skin).rotation.y=a;}ell([0,y+.7,0],[.14,.14,.15],skin);eyes([0,y+.73,.14],.08);}
  } else {
    // Toads, newts, beetles and mollusks share joint construction, not their silhouettes.
    const beetle=form==='beetle',mollusk=form==='mollusk',newt=form==='newt';
    const tall=s.detail==='tall'||beetle||mollusk,y=tall?1.25:.7;
    ell([0,y,0],[newt?.3:beetle?.37:.46,tall?.68:.5,newt?.57:.34],skin);
    ell([0,y+.45,.22],[newt?.2:.3,.22,.27],skin);eyes([0,y+.5,.46],.18);
    if(beetle){for(const side of [-1,1]){ell([side*.18,y+.08,-.11],[.2,.66,.25],side===1?accent:skin);arm([side*.36,y+.25,0],side,.54);antenna([side*.13,y+.66,.18],s.detail==='antennae'?.65:.3);}beam([0,y-.45,.29],[0,y+.57,.3],.016,dark);}
    if(mollusk) {for(let i=0;i<6;i++)curve([[(i-2.5)*.1,y-.5,0],[(i-2.5)*.12,.2,.12],[(i-2.5)*.19,.05,.22]],.03,accent);ell([0,y,-.13],[.47,.67,.27],accent);}
    else for(const side of [-1,1]){leg([side*.28,y-.2,0],[side*.13,-(y-.2)*.5,.05],[side*.18,-(y-.2)+.02,.24],beetle?.04:.07);if(!beetle)arm([side*.37,y+.15,.1],side,.35,false);}
    if(newt){curve([[0,y-.25,-.3],[0,.3,-.9],[.18,.5,-1.3],[.3,1.1,-1.25],[.18,1.3,-1.05]],.095,skin);if(s.detail==='curl')curve([[.18,1.3,-1.05],[0,1.5,-1.05],[-.2,1.4,-1.07],[-.05,1.3,-1.08]],.035,skin);}
    if(['bulb','ink'].includes(s.detail)){ell([0,y+.88,0],[.28,.43,.25],skin);curve([[0,y+1.1,0],[.1,y+1.55,0],[.05,y+1.8,0]],.05,skin);}
    if(s.detail==='trumpet'){beam([0,y+.45,.34],[0,y+.44,.9],.08,accent);ring([0,y+.44,.91],.16,accent);}
    if(['spores','scales','embers','paint'].includes(s.detail))for(let i=0;i<10;i++){const a=i*2.4;ell([Math.sin(a)*.35,y-.3+(i%5)*.16,.25+Math.cos(a)*.06],[.07,.09,.028],i%2?accent:brass);}
    if(['frill','horns'].includes(s.detail))for(let i=0;i<5;i++)cone([(i-2)*.12,y+.71-(Math.abs(i-2))*.08,.05],.065,.32,accent).rotation.z=(i-2)*-.23;
    if(s.detail==='shell')ell([0,y+.1,-.17],[.5,.57,.38],accent);
    if(s.detail==='luggage'){box([0,y,-.35],[.52,.66,.16],accent);curve([[-.12,y+.35,-.36],[-.12,y+.51,-.36],[.12,y+.51,-.36],[.12,y+.35,-.36]],.022,dark);}
  }
  const proportions={sentinel:[.78,1.24,.85],harvester:[1.08,.94,1],cutter:[1.16,.94,1],pruner:[1.12,1,1],welder:[1.08,1.07,1],ring:[.92,.87,.88],sign:[.95,1.15,.87],surveyor:[.8,1.18,.85],furnace:[1.1,1.1,1],winch:[1.05,1.1,1],relay:[.8,1.12,.85],observatory:[1,1,.9],gyro:[1.12,1.03,1],crucible:[1.18,.88,1],crane:[.8,1.24,.87],inspector:[1.06,1.1,1],porter:[1.22,1.05,1],watering:[1.1,.94,1],drawing:[1.12,.87,1]};
  if(s.family==='machine'&&proportions[form])body.scale.set(...proportions[form]);
  // Batch stationary pieces within each joint; keep animated wings, cloth and rotors independent.
  const animated=new Set([...smoke,...rotors]);
  const parents=[];group.traverse(o=>{if(o.isGroup)parents.push(o);});
  for(const parent of parents){
    const buckets=new Map();
    for(const o of parent.children)if(o.isMesh&&!animated.has(o)){const list=buckets.get(o.material)??[];list.push(o);buckets.set(o.material,list);}
    for(const [mat,parts] of buckets)if(parts.length>1){
      const gs=parts.map(o=>{o.updateMatrix();const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();return g.applyMatrix4(o.matrix);});
      const merged=mergeGeometries(gs);for(const g of gs)g.dispose();
      if(merged){for(const o of parts){o.removeFromParent();o.geometry.dispose();}parent.add(new T.Mesh(merged,mat));}
    }
  }
  group.scale.setScalar(s.scale);
  group.traverse(o=>{o.userData.noCollide=true;o.userData.dynamic=true;if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  group.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(group), size=bounds.getSize(new T.Vector3());
  const result={group,body,parts:body.children.filter(o=>!animated.has(o)),size:s.scale,eyeMat:eye,ownedMaterials:mats,reference:s.reference,height:Math.max(.45,size.y*.5),radius:Math.min(.85,Math.max(.35,Math.min(size.x,size.z)*.5)),limbs,wings,
    animate(f,dt,t){
      const moving=['chase','home'].includes(f.state),w=f.state==='wind'?Math.min(1,f.k):0,k=f.state==='strike'?Math.sin(f.k*Math.PI):0;
      const motion=f.def.attack.motion,active=f.state==='strike';
      body.position.y=(moving?Math.abs(Math.sin(t*7))*.06:Math.sin(t*2)*.012)+(motion==='slam'?(w*.14-k*.12):0);
      body.rotation.set(motion==='charge'||motion==='peck'?-w*.13+k*.25:0,motion==='sweep'?(-w*.4+k*.8):0,0);
      for(const l of limbs){const walk=moving?Math.sin(t*7+(l.side>0?Math.PI:0))*.2:0;
        l.o.rotation.x=l.role==='leg'?walk:l.role==='nozzle'?-w*.12:l.role==='arm'?-w*.9+k*1.05:0;
        l.o.rotation.z=l.role==='arm'?l.side*(motion==='pull'?(w*.5-k*.6):motion==='claw'?w*.35-k*.5:0):0;
      }
      for(const wing of wings)wing.o.rotation.z=wing.side*(.16+Math.sin(t*(w?18:8))*.25+w*.5-(active&&motion==='dive'?.25:0));
      for(let i=0;i<smoke.length;i++)smoke[i].rotation.z=Math.sin(t*1.7+i)*.045;
      for(const rotor of rotors)rotor.rotation.y+=dt*(w?7:1.2);
      eye.uniforms.uColor.value.set(w?'#f3a361':f.stunned>0?'#bfe9ff':'#f8e8bb');
      group.scale.setScalar(s.scale);group.position.y+=f.alt;
    },
    dispose(){for(const m of mats)releaseMaterial(m);},
  };
  return result;
}
