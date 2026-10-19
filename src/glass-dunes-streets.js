import { crowdedBlock, planeBook } from './glass-dunes-masses.js';
import { stairFlight } from './levels/eclipse-kit.js';
import { box,terrace,windingStair,opening } from './glass-dunes-architecture.js';
import { stoneBridge } from './glass-dunes-civic-kit.js';

/** Tall shared street edges, upper bays and a crossing above a narrow lane.
 * All coordinates stay clear of the original landing, sand exit and clock square. */
export function buildBuriedStreets(kit,M){
  // The buried city plate: pale cream stone crowded with jutting rooms, small amber windows, blue-grey
  // shade; colour stays in a few painted doors. Blocks in the street's shadow side go a cooler grey.
  const mat=(color,o={})=>kit.mat({color,line:.6,hatch:.15,weathered:.8,detail:'built',detailDensity:.8,patches:.4,shade:.08,shadeHue:.9,...o});
  for(const [key,color] of Object.entries({stone:'#e9dfc9',trim:'#d6ccb5',blue:'#c9c3b0',plum:'#d2c7b0',coral:'#ddd2ba',violet:'#c7bea9',slate:'#8597a3'}))M[key]=mat(color);
  M.gold=kit.mat({color:'#e8b04e',line:.4,hatch:.1,detail:'none',shade:.15,shadeHue:.75});M.ochre=M.gold;
  M.windowLight=kit.mat({color:'#ffc871',glow:1.4,line:.15,hatch:0,shade:.05});
  const B={...M,lit:M.windowLight,hole:kit.mat({color:'#2f3836',line:.2,hatch:0,shade:.1}),door:kit.mat({color:'#8a5a3a',line:.3,hatch:.1,shade:.1})};
  const rows=[
    [-29,-28,14,10,14.3,'stone',0],[-14,-28,14,10,13.5,'stone',0],[0,-28,12,10,14.5,'trim',0],[13,-28,12,10,13.6,'stone',0],
    [-29,-14,14,12,13.8,'slate',Math.PI/2],[-29,-1,14,12,14.6,'slate',Math.PI/2],[-29,12,14,12,13.5,'slate',Math.PI/2],[-29,25,14,11,14.5,'slate',Math.PI/2],[-29,37,14,10,13.7,'slate',Math.PI/2],
    [-8,-13,8,10,13.6,'stone',-Math.PI/2],[-8,2,7,8,14.3,'trim',-Math.PI/2],
    [41,-19,8,11,14.7,'stone',-Math.PI/2],[40,-4,9,12,13.7,'stone',-Math.PI/2],[40,10,9,11,14.5,'trim',-Math.PI/2],[39,24,10,12,13.4,'stone',-Math.PI/2],
    [29,39,12,10,14.3,'stone',Math.PI],[16,39,11,10,13.6,'trim',Math.PI],[-13,39,12,10,13.5,'stone',Math.PI],
    [11,-17,9,10,13.8,'stone',0],
  ];
  // Retain the two original approaches to the west gallery, now enclosed by houses.
  box(kit,M.violet,-18,3.8,-7,4,.4,16);
  for(const x of [-18,-10])stairFlight(kit,{step:x===-18?M.blue:M.coral,stone:x===-18?M.blue:M.coral},{x,z:27,y0:0,y1:4,w:4,run:.55,rise:.18,cheek:.6});
  box(kit,M.plum,-18,3.8,8,4,.4,14);box(kit,M.violet,-13.98,3.82,12.98,11.96,.4,3.96);   // (2 cm over and inside the plum walk it crosses: issue #498)
  const routes=[],walks=[];
  windingStair(kit,{stone:M.blue,step:M.blue},routes,[[-18,4,0],[-18,6,-5],[-18,8,-11]],{w:3.2,thin:true,outer:false});
  terrace(kit,M.blue,{x:-18,z:-11,y:7.4,h:.6,rx:2.7,rz:2.2});
  walks.push(stoneBridge(kit,{stone:M.plum},{from:[-18,8,-11],to:[-12.3,8,-11],w:3,drop:1.4,rail:.55}));
  box(kit,M.coral,-12.3,7.7,-11,1.5,.6,4);
  opening(kit,M,{x:-12.12,y:8,z:-11,yaw:-Math.PI/2,w:.9,h:2.6,paint:'gold'});
  // Continue around the painted bay to a second crossing above the clock street.
  windingStair(kit,{stone:M.coral,step:M.coral},routes,[[-12.3,8,-11],[-13,8,-5],[-8,9.5,-5],[-2,11,-5],[-2,11,-10]],{w:2.5,thin:true,outer:false});
  terrace(kit,M.coral,{x:-2,z:-10,y:10.4,h:.6,rx:2,rz:2});
  walks.push(stoneBridge(kit,M,{from:[-2,11,-10],to:[9,11,-10],w:2.6,drop:3.5,rail:.5}));
  box(kit,M.stone,9,10.7,-10,3,.6,3);
  // An arched span high across the lane, block to block (scenery: the plate's bridge over the street).
  stoneBridge(kit,{stone:M.stone},{from:[-25,19,-15],to:[-9,19,-15],w:4.5,drop:3.2,rail:1.1});
  box(kit,M.trim,-17,21.2,-15,16,.5,5);
  // The blocks last: no room juts over a stair, a landing or a bridge.
  const samples=[];
  for(const r of routes)for(let i=1;i<r.via.length;i++)for(let t=0;t<=1;t+=.2)samples.push(r.via[i-1].map((v,k)=>v+(r.via[i][k]-v)*t));
  for(const [a,b] of walks)for(let t=0;t<=1;t+=.1)samples.push(a.map((v,k)=>v+(b[k]-v)*t));
  const clear=(x,y,z,r)=>samples.some(([sx,sy,sz])=>Math.hypot(x-sx,z-sz)<r+2.2&&y<sy+3.5&&y>sy-8);
  const planes=planeBook();   // (one for the street: no room in another block's plane, issue #498)
  rows.forEach(([x,z,w,d,h,color,yaw],i)=>{const facingX=Math.abs(Math.sin(yaw))>.5;crowdedBlock(kit,{...B,wall:M[color]},{x,z,w:facingX?d:w,d:facingX?w:d,h:44+(i*7)%15,yaw,seed:300+i,lit:.3,clear,planes});});
  return{routes,walks,windowMaterial:M.windowLight};
}
