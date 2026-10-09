import * as THREE from 'three';
import { MASKS } from '../costumes.js';
import { QUEST_LOOKS } from './quest-looks.js';

// Named-only costume geometry, in the same head/chest/right-hand/back frames as
// costumes.js. Humanoid binds it to the existing bones on BOTH body families.
// No separate render pass, texture baking or replacement animation skeleton.
const P = (role, geo) => ({ role, geo });
const ball = (r, x, y, z, sy = 1) => new THREE.SphereGeometry(r, 12, 8).scale(1, sy, 1).translate(x,y,z);
const box = (w,h,d,x,y,z) => new THREE.BoxGeometry(w,h,d).translate(x,y,z);
const cone = (r,h,x,y,z,n=12) => new THREE.ConeGeometry(r,h,n).translate(x,y,z);
const ring = (r,t,x,y,z) => new THREE.TorusGeometry(r,t,5,20).translate(x,y,z);
function rod(a,b,r=.012) {
  const A=new THREE.Vector3(...a), B=new THREE.Vector3(...b), d=B.clone().sub(A);
  return new THREE.CylinderGeometry(r,r,d.length(),8).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize())).translate(...A.add(B).multiplyScalar(.5).toArray());
}
function tube(points,r=.01) { return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),24,r,6,false); }
const metal='#baa980', cream='#e8debf', ink='#3f4140', wood='#91744d';
function bell(x,y,z,r=.035) {return [P(metal,cone(r,r*1.3,x,y,z)),P(ink,ball(r*.35,x,y-r*.7,z))];}
function jar(x,y,z,r=.065,role='clay') {return [P(role,ball(r,x,y,z,1.2)),P(role,new THREE.CylinderGeometry(r*.5,r*.6,r*.4,10).translate(x,y+r,z)),P(ink,new THREE.TorusGeometry(r*.42,.005,5,20).rotateX(Math.PI/2).translate(x,y+r*1.2,z))];}
function lamp(x,y,z,r=.045){return [P(metal,rod([x,y+r,z],[x,y+r*1.65,z],r*.15)),P(metal,cone(r*1.3,r*.5,x,y+r*1.6,z)),P('lamp',ball(r,x,y,z,1.25)),P(metal,ring(r*.65,.007,x,y+r*2,z))];}
function feather(x,y,z,h=.13,role=cream){return [P(role,new THREE.SphereGeometry(.02,6,6).scale(1,h/.04,.25).rotateZ(-.3).translate(x,y,z)),P(wood,rod([x-.015,y-h*.5,z],[x+.015,y+h*.5,z],.002))];}
function ladder(x,y,z,h=.7){const a=[P(wood,rod([x-.1,y-h/2,z],[x-.1,y+h/2,z],.014)),P(wood,rod([x+.1,y-h/2,z],[x+.1,y+h/2,z],.014))];for(let i=0;i<6;i++)a.push(P(wood,rod([x-.1,y-h/2+i*h/5,z],[x+.1,y-h/2+i*h/5,z],.009)));return a;}
function coil(x,y,z,r=.1,n=4){return Array.from({length:n},(_,i)=>P(wood,ring(r+i*.007,.006,x,y,z+i*.005)));}
function keys(x=.19,y=.08,z=.18){let a=[P(metal,ring(.055,.007,x,y,z))];for(let i=0;i<4;i++){let X=x+(i-1.5)*.025;a.push(P(metal,rod([X,y-.03,z],[X,y-.15-i*.008,z],.006)),P(metal,box(.025,.015,.01,X+.01,y-.13-i*.008,z)));}return a;}
function bag(x,y,z,w=.16,h=.2,role='canvas') {return [P(role,box(w,h,.075,x,y,z)),P(role,box(w*1.04,h*.3,.085,x,y+h*.4,z+.004)),P(metal,ball(.012,x,y+h*.2,z+.047))];}
function strap(a,b,role=wood){return P(role,rod(a,b,.015));}
function prism(points,depth=.035){const sh=new THREE.Shape();sh.moveTo(...points[0]);for(const p of points.slice(1))sh.lineTo(...p);sh.closePath();return new THREE.ExtrudeGeometry(sh,{depth,bevelEnabled:false});}

function headKit(id) {
 const a=[];const add=(c,g)=>a.push(P(c,g));
 switch(id){
 case 'wimple':
   add('hat',prism([[-.17,-.18],[-.11,.12],[0,.55],[.16,-.2],[.08,-.12],[.075,.07],[-.075,.07],[-.08,-.12]]).translate(0,0,-.06));
   add(cream,rod([0,.52,-.025],[.16,-.2,-.025],.004));break;
 case 'guardCrest':
   add('hat',new THREE.CylinderGeometry(.08,.11,.38,6).translate(0,.29,0));add(metal,cone(.1,.22,0,.58,0,4));add(metal,ball(.035,0,.72,0));break;
 case 'beakedCowl': {
   const g=new THREE.BufferGeometry();
   g.setAttribute('position',new THREE.Float32BufferAttribute([-.13,.15,-.06, .13,.15,-.06, 0,.25,.01, 0,.12,.36, -.105,.095,.09, .105,.095,.09],3));
   g.setIndex([0,2,3, 2,1,3, 0,3,4, 1,5,3, 4,3,5, 0,4,5, 0,5,1, 0,1,2]);g.computeVertexNormals();
   add('hat',g);for(const x of [-.139,.139])add(ink,ball(.009,x,.12,.015));break;
 }
 case 'hoodLamps':for(let i=0;i<7;i++){const t=(i/6)*Math.PI;a.push(...lamp(Math.cos(t)*.125,Math.sin(t)*.16-.005,.10,.018));}break;
 case 'balancedStones':{let y=.10;for(let i=0;i<3;i++){const r=.054-i*.011;y+=r*.48;add('#aaa38c',ball(r,0,y,0,.48));y+=r*.48-.002;}break;}
 case 'paperStack':for(let i=0;i<9;i++)add(i%2?cream:'#ccc4ab',box(.2,.018,.17,(i%3-1)*.012,.15+i*.02,0).rotateY(i*.025));add(ink,rod([0,.3,0],[.025,.49,0],.004));break;
 case 'antennaHelmet':case 'dishHelmet':case 'featherAntenna':case 'turbanAntenna':
   for(const x of [-.12,.12]){add(metal,rod([x,.08,0],[x*1.7,.39,-.02],.005));add(metal,ball(.012,x*1.7,.39,-.02));}
   if(id==='featherAntenna')a.push(...feather(.13,.2,-.01,.23));
   if(id==='dishHelmet')add(metal,new THREE.SphereGeometry(.075,12,8,0,Math.PI*2,0,.9).rotateX(Math.PI/2).translate(0,.27,.02));break;
 case 'dishHeadset':
   for(const x of [-.12,.12]){add(ink,ball(.052,x,0,0));add(metal,ball(.037,x*1.12,0,0));}
   add(ink,tube([[-.12,0,0],[-.11,.16,0],[.11,.16,0],[.12,0,0]],.015));add(metal,rod([0,.16,0],[0,.33,0],.008));
   add('accent',new THREE.SphereGeometry(.14,14,8,0,Math.PI*2,0,1.2).rotateX(Math.PI/2).translate(0,.36,.01));break;
 case 'porthole':case 'counterDome':
   add(metal,ring(.119,.018,0,.015,.09));
   if(id==='counterDome'){add(metal,tube([[-.11,-.03,.08],[-.13,.15,.025],[0,.25,-.03],[.13,.15,.025],[.11,-.03,.08]],.007));add(metal,ring(.045,.009,0,.29,0));add(cream,ball(.035,0,.29,0,.8));}break;
 case 'headLamp':a.push(...lamp(0,.2,.015,.035));break;
 case 'cupHat':for(let i=0;i<10;i++){let t=i*Math.PI/5;a.push(...jar(Math.sin(t)*.24,.1,Math.cos(t)*.24,.025,metal));}break;
 case 'vineHat':for(let i=0;i<12;i++){let t=i*.55;add('#7b9470',ball(.028,Math.sin(t)*.22,.11+Math.sin(t*3)*.025,Math.cos(t)*.22,.45));}break;
 case 'pyramidHat':add('hat',cone(.23,.24,0,.22,0,4));break;
 case 'halo':add(metal,ring(.27,.005,0,.16,-.09));add(metal,ring(.2,.004,0,.16,-.1));break;
 case 'orbTip':add(metal,ball(.035,0,.795,-.118));break;
 case 'shellHood':
   for(let i=0;i<13;i++){let t=(i/12)*Math.PI;a.push(P(cream,rod([0,.02,-.13],[Math.cos(t)*.22,Math.sin(t)*.27+.02,-.11],.008)));}break;
 case 'crystalCrown':for(let i=0;i<9;i++){const t=i/9*Math.PI*2;add('#90bdb2',cone(.025,.12+(i%3)*.025,Math.cos(t)*.1,.14,Math.sin(t)*.1,4));}break;
 case 'mushroom':add('hat',new THREE.SphereGeometry(.27,16,8,0,Math.PI*2,0,Math.PI/2).scale(1,.4,1).translate(0,.12,0));add(cream,new THREE.CylinderGeometry(.25,.25,.009,16).translate(0,.12,0));break;
 case 'mossHood':for(let i=0;i<18;i++){let t=i*.37;add('#64783e',ball(.03,Math.sin(t)*.13,.07+(i%3)*.04,Math.cos(t)*.12,.6));}break;
 case 'brushBeret':for(let i=0;i<4;i++){const x=(i-1.5)*.05;add(wood,rod([x,.1,0],[x*1.8,.29,0],.007));add(i%2?'accent':'cloth',box(.018,.052,.012,x*1.8,.31,0));}break;
 case 'lanternHat':for(let i=0;i<6;i++){let t=i/6*Math.PI*2,x=Math.sin(t)*.22,z=Math.cos(t)*.22;add(ink,rod([x,.1,z],[x,-.03,z],.002));a.push(...lamp(x,-.09,z,.025));}break;
 }
 return a;
}
function toolKit(id){
 const a=[];const add=(c,g)=>a.push(P(c,g));const pole=(top=.72,bottom=-.73)=>add(wood,rod([0,bottom,.025],[0,top,.025],.012));
 switch(id){
 case 'staff':case 'measurePole':case 'reedStaff':pole();if(id==='measurePole')for(let i=0;i<14;i++)add(ink,box(.027,.004,.027,0,-.65+i*.1,.025));break;
 case 'broom':pole(.5,-.61);for(let i=0;i<14;i++)add('#6a8fad',rod([(i%7-3)*.012,-.6,.015+Math.floor(i/7)*.02],[(i%7-3)*.025,-.8,.015+Math.floor(i/7)*.02],.006));break;
 case 'cane':case 'cogCane':case 'trumpetCane':pole(.09,-.73);add(metal,ball(.024,0,.1,.025));if(id==='cogCane')a.push(...gear(0,.12,.025,.06));if(id==='trumpetCane')add(metal,new THREE.CylinderGeometry(.08,.012,.2,12).rotateZ(-1.1).translate(.05,.18,.025));break;
 case 'halberd':pole(1,-.73);add(metal,cone(.04,.19,0,1.08,.025,4));add(metal,prism([[0,.7],[.14,.82],[.17,.96],[.04,.93]],.02).translate(0,0,.025));break;
 case 'windStaff':pole(.85,-.73);add(metal,rod([-.12,.82,.025],[.14,.82,.025],.005));add('accent',prism([[.12,.77],[.22,.82],[.12,.87]],.01).translate(0,0,.025));add(metal,rod([-.1,.82,.025],[-.1,.70,.025],.004));a.push(...lamp(-.1,.59,.025));break;
 case 'lamppole':pole(.85,-.73);add(wood,tube([[0,.8,.025],[.08,.89,.025],[.16,.81,.025],[.15,.72,.025]],.012));add(metal,rod([.15,.72,.025],[.15,.70,.025],.004));a.push(...lamp(.15,.59,.025));break;
 case 'eggStaff':case 'tuningFork':case 'flag':pole(.85,-.73);if(id==='eggStaff')add('lamp',ball(.08,0,.92,.025,1.3));if(id==='tuningFork'){add(metal,tube([[-.07,1.04,.025],[-.07,.8,.025],[.07,.8,.025],[.07,1.04,.025]],.014));}if(id==='flag')add('accent',prism([[0,.8],[.2,.74],[0,.66]],.006).translate(0,0,.025));break;
 case 'mallet':pole(.25,-.23);add(cream,new THREE.CylinderGeometry(.06,.06,.2,12).rotateZ(Math.PI/2).translate(0,.24,.025));break;
 case 'sickle':case 'feedingHook':case 'trimmer':pole(.42,-.48);add(metal,tube([[0,.4,.025],[.14,.48,.025],[.23,.42,.025],[.19,.32,.025]],id==='sickle'?.018:.009));break;
 case 'paintBrush':pole(.15,-.2);add('accent',box(.045,.085,.025,0,.2,.025));break;
 case 'wrench':pole(.23,-.26);add(metal,tube([[-.055,.29,.025],[-.055,.23,.025],[.055,.23,.025],[.055,.29,.025]],.018));break;
 case 'earhorn':add(cream,new THREE.CylinderGeometry(.09,.015,.35,12).rotateZ(-.6).translate(.03,.12,.07));break;
 case 'whistle':add(cream,new THREE.CylinderGeometry(.018,.018,.13,8).translate(0,.025,.025));a.push(...feather(.03,-.06,.03,.12));break;
 case 'toyBird':add(cream,ball(.06,0,.01,.07,.65));add(cream,cone(.025,.07,0,.04,.15).rotateX(0));add(wood,rod([0,-.1,.025],[0,.02,.025],.006));break;
 case 'writingBoard':case 'clipboard':case 'barkMap':add(wood,box(.19,.26,.015,0,-.13,.06));add(cream,box(.16,.23,.003,0,-.12,.07));for(let i=0;i<4;i++)add(ink,box(.10-i*.01,.003,.002,0,-.06-i*.035,.073));break;
 case 'receiver':add('#8b9f98',box(.2,.16,.09,0,-.11,.05));for(let x of [-.06,.06])add(metal,ball(.023,x,-.1,.1,.9));add(ink,rod([.08,-.03,.05],[.08,.14,.05],.004));break;
 case 'abacus':add(wood,box(.22,.18,.025,0,-.1,.055));for(let j=0;j<4;j++){add(metal,rod([-.1,-.04-j*.04,.077],[.1,-.04-j*.04,.077],.003));for(let i=0;i<4;i++)add(metal,ball(.012,-.06+i*.035,-.04-j*.04,.08));}break;
 case 'mirror':add(metal,ring(.13,.009,0,-.1,.045));add('#b6d0cb',new THREE.CircleGeometry(.123,24).translate(0,-.1,.045));break;
 case 'bowl':add(metal,new THREE.SphereGeometry(.13,16,8,0,Math.PI*2,Math.PI/2,Math.PI/2).translate(.02,-.04,.06));break;
 case 'pendulum':add(metal,rod([0,.02,.025],[0,-.25,.025],.002));add('accent',cone(.035,.1,0,-.27,.025,4));break;
 case 'oilcan':case 'wateringCan':case 'teapot':a.push(...jar(0,-.15,.05,.085,id==='oilcan'?metal:'accent'));add(metal,ring(.06,.012,-.08,-.11,.05));add(metal,rod([.06,-.14,.05],[.21,-.03,.05],.012));break;
 case 'shears':add(metal,rod([-.05,-.1,.03],[.05,.1,.03],.008));add(metal,rod([.05,-.1,.03],[-.05,.1,.03],.008));break;
 case 'rule':add(wood,box(.025,.5,.018,0,.05,.025));break;
 case 'toyWheel':pole(.2,-.58);a.push(...gear(0,-.66,.025,.1));break;
 case 'lanternPole':pole(.85,-.65);add(wood,rod([-.23,.72,.025],[.23,.72,.025],.009));for(const x of [-.2,.2])add(metal,rod([x,.72,.025],[x,.68,.025],.004));a.push(...lamp(-.2,.57,.025),...lamp(.2,.57,.025));break;
 default:return null; // keep the established lantern/basket/bell (and their grip).
 }return a;
}
function gear(x,y,z,r=.055){const a=[P(metal,ring(r,.009,x,y,z))];for(let i=0;i<8;i++){const t=i*Math.PI/4;a.push(P(metal,box(.018,.025,.014,0,r,0).rotateZ(t).translate(x,y,z)));}return a;}

function wornKit(id){
 const chest=[],back=[];const add=(c,g)=>chest.push(P(c,g));const pack=(p)=>back.push(...p);
 const pouch=()=>chest.push(...bag(.19,.08,.19));
 const diagonal=()=>chest.push(strap([-.17,.69,.15],[.21,.05,.18]));
 switch(id){
 case 'dustpan':add(metal,box(.11,.12,.015,.19,.09,.19));add(wood,rod([.19,.13,.19],[.19,.3,.19],.005));break;
 case 'fanCollar':add('accent',prism([[-.3,.61],[-.27,.84],[-.1,.69],[0,.63],[.1,.69],[.27,.84],[.3,.61],[0,.48]],.03).translate(0,0,.13));break;
 case 'sash':diagonal();chest.push(...bag(-.19,.05,.1,.12,.1,metal));break;
 case 'prayer':for(let x of [-.17,.17])for(let i=0;i<9;i++)add(metal,ball(.012,x,.63-i*.035,.17));break;
 case 'redCord':add('#b95743',tube([[-.16,.65,.1],[0,.53,.2],[.16,.65,.1]],.008));break;
 case 'patches':add(cream,box(.085,.10,.01,-.08,.36,.19));break;
 case 'feathers':for(let i=0;i<5;i++)chest.push(...feather((i-2)*.045,.2,.19,.15));break;
 case 'pebbles':pouch();for(let i=0;i<6;i++)add('#98a19b',ball(.023,.15+(i%3)*.035,.17+Math.floor(i/3)*.03,.24));break;
 case 'keys':chest.push(...keys());break;
 case 'stones':for(let i=0;i<4;i++)add('#9c9989',ball(.027,-.18+(i%2)*.03,.15+Math.floor(i/2)*.03,.19,.6));break;
 case 'bellRope':chest.push(...coil(.13,.52,.19,.11,6),...bell(0,.5,.2,.055));break;
 case 'cloudJar':chest.push(...lamp(.2,.1,.19,.06));break;
 case 'maps':pack(bag(0,.36,-.22,.23,.3));for(let i=0;i<3;i++)back.push(P(cream,new THREE.CylinderGeometry(.025,.025,.33,10).translate((i-1)*.07,.62,-.25)));break;
 case 'mechanic':case 'rigger':diagonal();for(let i=0;i<5;i++){let x=(i-2)*.06;add(metal,rod([x,.24,.19],[x,.08,.19],.008));}pack(coil(0,.4,-.24,.13,5));break;
 case 'tape':add('accent',tube([[-.1,.71,.15],[-.1,.26,.19],[.02,.23,.2],[.1,.7,.15]],.012));break;
 case 'cable':pack(coil(.03,.5,-.24,.13,5));diagonal();break;
 case 'cameo':add(metal,tube([[-.08,.7,.12],[0,.49,.2],[.08,.7,.12]],.003));add(cream,ball(.032,0,.49,.2,1.3));break;
 case 'oilApron':for(let x of [-.30,.30])chest.push(...jar(x,.1,.21,.055,metal));break;
 case 'apron':add('canvas',box(.30,.48,.02,0,.3,.19));break;
 case 'counter':add(metal,box(.09,.06,.04,.12,.56,.19));break;
 case 'bellows':pack([P('#7b6b50',box(.25,.42,.16,0,.38,-.25))]);for(let i=0;i<9;i++)back.push(P(metal,box(.27,.009,.18,0,.2+i*.045,-.25)));add(metal,tube([[.12,.7,-.17],[.26,.65,-.03],[.21,.56,.14],[.12,.66,.2]],.015));break;
 case 'cogs':for(let i=0;i<3;i++)chest.push(...gear((i-1)*.06,.26-i*.04,.18,.025));break;
 case 'wheelKeys':chest.push(...keys(),...gear(-.2,.17,.19,.085));add(ink,ball(.035,-.21,.71,0,.6));break;
 case 'clockGears':chest.push(...gear(.14,.15,.19,.075),...gear(.22,.1,.17,.04));break;
 case 'ladder':pack(ladder(0,.41,-.23,.85));diagonal();break;
 case 'seeds':pouch();for(let i=0;i<3;i++)add('lamp',ball(.016,.17+i*.025,.12,.24));break;
 case 'climbing':diagonal();add(wood,tube([[-.2,.12,.1],[0,.05,.2],[.2,.12,.1]],.018));pack(coil(0,.35,-.23,.12,4));back.push(P('#8fa679',new THREE.ConeGeometry(.30,.10,8).rotateX(.3).translate(0,.7,-.27)));break;
 case 'pendant':add(metal,ring(.04,.007,0,.43,.19));break;
 case 'sphereLamp':chest.push(...lamp(.19,.11,.2,.065));diagonal();break;
 case 'rope':chest.push(...coil(.1,.45,.18,.12,5));diagonal();break;
 case 'eggBasket':pack(bag(0,.38,-.27,.34,.36,wood));for(let i=0;i<7;i++)back.push(P('lamp',ball(.047,(i%3-1)*.09,.58+Math.floor(i/3)*.065,-.28,1.35)));break;
 case 'reeds':for(let i=0;i<14;i++)back.push(P(wood,rod([-.12+(i%5)*.04,.13,-.22],[.12+(i%5)*.04,.92+(i%3)*.06,-.22],.006)));diagonal();break;
 case 'crystals':case 'crystalMantle':for(let i=0;i<18;i++){let t=i*.9;add('#a5c3c0',cone(.014,.045,Math.sin(t)*.17,.65-(i%6)*.055,Math.cos(t)*.14,4));}break;
 case 'hemLamps':for(let i=0;i<5;i++)chest.push(...lamp((i-2)*.08,.12,.15,.022));break;
 case 'wickBag':pouch();diagonal();break;
 case 'moss':for(let i=0;i<35;i++){let t=i*.9;add(i%2?'#718544':'#849950',ball(.036,Math.sin(t)*.22,.63-(i%8)*.065,Math.cos(t)*.17,.65));}break;
 case 'gills':for(let i=0;i<16;i++){let t=i/16*Math.PI*2;add(cream,rod([Math.sin(t)*.1,.74,Math.cos(t)*.09],[Math.sin(t)*.29,.37,Math.cos(t)*.2],.02));}break;
 case 'barkMap':pouch();add(wood,box(.14,.2,.015,-.16,.2,.19));break;
 case 'radioCollar':add('accent',new THREE.CylinderGeometry(.25,.16,.18,10,1,true).translate(0,.64,0));for(let i=0;i<5;i++){let t=(i-2)*.45;add(ink,ball(.023,Math.sin(t)*.24,.68,Math.cos(t)*.24));}break;
 case 'parcel':diagonal();pack(bag(0,.36,-.27,.36,.44,cream));back.push(P(wood,box(.37,.018,.13,0,.36,-.27)),P(wood,box(.018,.44,.13,0,.36,-.27)));add('#8eaaa6',ball(.042,-.2,.76,0,.6));add(cream,ball(.025,-.19,.81,.02));break;
 case 'palette':add(wood,ball(.1,.2,.16,.19,1.35));for(let i=0;i<5;i++)add(['#be6949','#649f9b','#d7b65c','#9276a1','#e7dec4'][i],ball(.015,.17+(i%2)*.04,.10+Math.floor(i/2)*.035,.275,.8));break;
 case 'fishPurse':add('accent',ball(.06,.2,.12,.19,.65));add('accent',cone(.04,.08,.27,.12,.19,3).rotateZ(0));add(ink,ball(.008,.17,.13,.245));break;
 }return {chest,back};
}

// Replace a head silhouette rather than piling it onto an unrelated hat.
function referenceHead(design, look, humanoid) {
 const id=design.headKit, a=[];
 const hood=()=>a.push(P('hat',new THREE.SphereGeometry(.155,16,12,Math.PI/2+.72,Math.PI*2-1.44).scale(1,1.2,1.12).translate(0,.015,-.02)));
 if(['beakedCowl','wimple','openPadded'].includes(id)) {
   hood();
   if(id==='openPadded')a.push(P('accent',ring(.132,.018,0,0,.085).scale(1,1.18,1)));
   else a.push(...headKit(id));
 } else if(['porthole','counterDome'].includes(id)) {
   a.push(P('hat',ball(.16,0,.015,-.01,1.13)),P(ink,new THREE.CircleGeometry(.09,20).translate(0,-.015,.155)),P(metal,ring(.095,.016,0,-.015,.157)));
   if(id==='counterDome')a.push(P(metal,rod([0,.17,0],[0,.29,0],.01)),P(metal,ring(.045,.008,0,.32,0)),P(cream,new THREE.CircleGeometry(.037,16).translate(0,.32,.003)));
 } else if(id==='mushroom') {
   hood();a.push(...headKit(id));
 } else return null;
 // MakeHuman beards already arrive as skinned hair shells.
 if(look.mask!=='beard'||!humanoid?.profile)a.push(...(MASKS[look.mask]??MASKS.none)(1));
 return a;
}

function tunic(design, look) {
 if(!look.robe && !(look.bulk>=2))return [];
 const padded=look.bulk>=2, heavy=look.build==='heavy';
 const width=heavy?(padded?.32:.25):padded?.25:.21;
 const profile=[[.18,.12],[width,.25],[width*1.04,.43],[width*.92,.62],[.10,.72]];
 const shell=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),20).scale(1,1,.7);
 const a=[P(design.kit==='oilApron'?'cloak':'cloth',shell)];
 if(padded && design.kit!=='oilApron') for(let k=0;k<7;k++) {
   const y=.2+k*.062;
   const j=profile.findIndex(([,h])=>h>=y), [r0,y0]=profile[j-1], [r1,y1]=profile[j];
   const r=THREE.MathUtils.lerp(r0,r1,(y-y0)/(y1-y0))+.001;
   a.push(P('accent',new THREE.TorusGeometry(r,.0025,4,24).rotateX(Math.PI/2).scale(1,1,.705).translate(0,y,0)));
 }
 return a;
}

// Rounded sleeves and trouser legs follow the existing animation bones; hands
// and feet remain the actual articulated body. This gives the pressure suits
// volume instead of merely colouring skin as fabric.
function pressureSuit(look,h) {
 if(!(look.bulk>=2)||!h)return [];
 const a=[],bones=h.body.skeleton.bones;
 for(const side of ['l','r'])for(const [from,to,r] of [['upperarm','lowerarm',.105],['lowerarm','hand',.088],['thigh','calf',.125],['calf','foot',.1]]){
   const bone=h.b[`${from}_${side}`],end=h.b[`${to}_${side}`];if(!bone||!end)continue;
   const A=h.rest.get(bone).p,B=h.rest.get(end).p,d=B.clone().sub(A),len=d.length(),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
   const radius=r*(look.build==='heavy'?1.2:1), centre=A.clone().add(B).multiplyScalar(.5);
   const geo=new THREE.SphereGeometry(1,12,10).scale(radius,len*.58,radius).applyQuaternion(q).translate(...centre.toArray());
   const j=bones.indexOf(bone), joints=()=>[[j,0,0,0],[1,0,0,0]];
   a.push({role:from==='thigh'||from==='calf'?'legs':'cloth',geo,joints});
   for(let k=1;k<5;k++){
     const t=k/5,rad=radius*Math.sqrt(1-((t-.5)/.58)**2);
     const ringGeo=new THREE.TorusGeometry(rad,.0025,4,16).rotateX(Math.PI/2).applyQuaternion(q).translate(...A.clone().lerp(B,t).toArray());
     a.push({role:'accent',geo:ringGeo,joints});
   }
 }
 return a;
}

export function questPieces(look, pieces, humanoid = null) {
 const ref=look.reference;if(!ref)return pieces;
 const [world,id]=ref.split('/'), design=QUEST_LOOKS[world]?.[id];if(!design)return pieces;
 const extras=wornKit(design.kit), tool=toolKit(design.tool);
 const head=referenceHead(design,look,humanoid)??[...pieces.head,...headKit(design.headKit)];
 return {...pieces,head,chest:[...pieces.chest,...tunic(design,look),...extras.chest],back:[...pieces.back,...extras.back],hand:tool??pieces.hand,skinned:[...(pieces.skinned??[]),...pressureSuit(look,humanoid)]};
}

/** The cape clears the fuller tunic and hangs under the worn map bag. */
export function questCloth(look) {
 if(!look?.reference)return null;
 const wide=look.build==='heavy'?.25:.21;
 const body=look.robe>0?[{a:[-.10,.3,0],b:[-.10,.58,0],r:wide*.7},{a:[.10,.3,0],b:[.10,.58,0],r:wide*.7}]:[];
 if(look.kit==='pebbles')body.push({a:[.12,.14,.22],b:[.25,.22,.22],r:.065,under:true});
 const back=look.kit==='maps'?[{a:[-.07,.28,-.26],b:[.07,.52,-.26],r:.12,under:true}]:[];
 return {body,back};
}
