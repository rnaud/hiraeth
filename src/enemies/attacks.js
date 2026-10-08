import * as THREE from 'three';
import { inArea } from '../temples/boss.js';

// Every pattern uses a locked warning, explicit contact instants and a punishable recovery.
// The numerical footprint below is also the renderer's footprint; no invisible larger hitbox.
export const ATTACKS = {
  pincer: { name:'Crossing pincers', shape:'cone', range:2.7, angle:.65, wind:.85, strike:.65, contacts:[.36,.8], offsets:[-.35,.35], damage:.09, motion:'claw', recover:1.25 },
  rush: { name:'Committed rush', shape:'lane', range:6, width:1.45, wind:1.1, strike:.7, contacts:[.72], lunge:4.6, damage:.18, motion:'charge', recover:1.65 },
  peck: { name:'Spear peck', shape:'lane', range:3.6, width:.85, wind:.75, strike:.34, contacts:[.55], damage:.16, motion:'peck', recover:1.1 },
  tail: { name:'Tail sweep', shape:'cone', range:3.7, angle:1.45, wind:1.15, strike:.5, contacts:[.6], damage:.18, motion:'sweep', recover:1.4 },
  sweep: { name:'Scything sweep', shape:'cone', range:3.3, angle:1.2, wind:1, strike:.7, contacts:[.35,.8], offsets:[-.55,.55], damage:.09, motion:'sweep', recover:1.45 },
  stomp: { name:'Groundbreaker', shape:'ring', radius:3.1, wind:1.35, strike:.45, contacts:[.65], damage:.22, knock:6, motion:'slam', recover:1.8 },
  lob: { name:'Arcing glob', shape:'ring', at:'target', radius:1.65, wind:1.3, strike:.75, contacts:[.9], damage:.17, motion:'lob', recover:1.5 },
  volley: { name:'Three-shot barrage', shape:'ring', at:'target', radius:1.05, spread:2.5, wind:1.5, strike:1.2, contacts:[.38,.65,.92], damage:.09, motion:'lob', recover:1.7 },
  jet: { name:'Pressure jet', shape:'lane', range:7, width:1.25, wind:1.15, strike:.8, contacts:[.22,.5,.8], damage:.055, knock:2, motion:'jet', recover:1.5 },
  beam: { name:'Focused beam', shape:'lane', range:10, width:1.0, wind:1.45, strike:.55, contacts:[.55], damage:.2, motion:'beam', recover:1.8 },
  pulse: { name:'Expanding pulse', shape:'ring', radius:4.3, wind:1.4, strike:.7, contacts:[.8], damage:.18, knock:4, motion:'pulse', recover:1.65 },
  pull: { name:'Drawing current', shape:'cone', range:6, angle:.65, wind:1.3, strike:.65, contacts:[.6], damage:.12, pull:4.5, motion:'pull', recover:1.65 },
  dive: { name:'Diving pass', shape:'lane', range:7, width:1.75, wind:1.25, strike:.75, contacts:[.72], lunge:5.5, dive:true, damage:.18, motion:'dive', recover:2 },
  gust: { name:'Wing buffet', shape:'cone', range:5, angle:.9, wind:1.2, strike:.6, contacts:[.65], damage:.12, knock:5, motion:'gust', recover:1.4 },
  sting: { name:'Needle thrust', shape:'lane', range:4.5, width:.7, wind:.95, strike:.4, contacts:[.65], lunge:1.3, damage:.17, motion:'peck', recover:1.25 },
};

export function speciesAttacks(species) {
  return species.attacks.map((id,i) => ({...ATTACKS[id], id:`${species.id}/${id}`, label:`${species.name} · ${ATTACKS[id].name}`, color:species.category==='shadow-spirit'?'#82669d':species.category==='possessed-machine'?'#d69156':species.color, index:i}));
}
export function attackReach(a) { return a.at==='target'?9:a.shape==='lane'?Math.min(6,a.range*.75):a.range?Math.min(a.range*.7,4):a.radius*.72; }

/** Cache warning/contact zones at commitment: target movement cannot steer a released attack. */
export function lockAttack(f, player) {
  const a=f.def.attack, origin=f.pos.clone();
  f.attackAt.copy(a.at==='target'?player.pos:origin).setY(origin.y); f.attackH=f.heading;
  f.zones=a.contacts.map((contact,i) => {
    const at=f.attackAt.clone();
    if(a.spread) {const side=(i-1)*a.spread;at.x+=Math.cos(f.heading)*side;at.z-=Math.sin(f.heading)*side;}
    return {attack:a,at,heading:f.heading+(a.offsets?.[i]??0),contact,done:false};
  });
  f.contacted=false;
}
export function speciesContact(f, zone, player, env, playerOk) {
  return playerOk && Math.abs(player.pos.y-zone.at.y)<1.6 && inArea(zone.attack,zone.at,zone.heading,player.pos)
    && (env.seen?.(f.chest,player.pos)??true);
}

/** Visible projectiles/energy use the same world-space zones as damage. */
export function poseAttackEffect(mesh, f, zone, t) {
  const a=zone.attack, u=THREE.MathUtils.clamp(f.k/zone.contact,0,1);
  mesh.visible=f.state==='strike' && f.k<=zone.contact+.1;
  if(!mesh.visible)return;
  if(a.motion==='lob') {
    mesh.position.lerpVectors(f.chest,zone.at,u);mesh.position.y+=Math.sin(Math.PI*u)*2.8;
    mesh.scale.setScalar(.18);mesh.rotation.set(0,0,0);
  } else if(a.shape==='lane') {
    mesh.position.copy(zone.at).add(new THREE.Vector3(Math.sin(zone.heading),0,Math.cos(zone.heading)).multiplyScalar(a.range*.5));mesh.position.y+=.6;
    mesh.rotation.set(0,zone.heading,0);mesh.scale.set(a.width*.25,.16,a.range*.5);
  } else {mesh.position.copy(zone.at);mesh.position.y+=.16;mesh.rotation.set(0,zone.heading,0);mesh.scale.setScalar(.12+u*(a.radius??a.range)*.2);}
}
