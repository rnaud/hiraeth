import * as THREE from 'three';
import { Paint, spindle } from '../vehicle-kit.js';

/** Kamal's self-powered fan sled, sharing only the rider anchor with the prize bike. */
export function buildRivalSled() {
  const root = new THREE.Group(), body = new THREE.Group();
  root.name = 'Kamal-fan-sled'; root.add(body);
  const hull = new Paint(), fittings = new Paint();
  const teal = '#3f7c82', cream = '#e9d6aa', dark = '#34405e', brass = '#bf9854';
  // Two broad skids and a blunt cowling give it a very different silhouette
  // from the slender fluid-powered prize bike.
  for (const side of [-1, 1]) {
    hull.add(spindle([[.08,-1.5],[.24,-1.2],[.28,.65],[.23,1.35],[.08,1.65]], {seg:10,sx:1,sy:.55}), teal, {at:[side*.76,-.35,0]});
    fittings.add(new THREE.BoxGeometry(.12,.11,2.2),cream,{at:[side*.76,-.18,.05]});
    fittings.add(new THREE.BoxGeometry(.5,.1,.16),brass,{at:[side*.5,-.2,-.55]});
    fittings.add(new THREE.BoxGeometry(.5,.1,.16),brass,{at:[side*.5,-.2,.75]});
    fittings.add(new THREE.BoxGeometry(.23,.08,.52),dark,{at:[side*.44,-.17,-.1]});
  }
  hull.add(new THREE.SphereGeometry(1,12,8),cream,{at:[0,.05,.7],scale:[.64,.38,.76]});
  hull.add(new THREE.CapsuleGeometry(.2,.62,3,10).rotateX(Math.PI/2),dark,{at:[0,.31,-.3],scale:[1.25,.5,1]});
  fittings.add(new THREE.BoxGeometry(.42,.12,.1),dark,{at:[0,.4,-.7]});
  fittings.add(new THREE.CylinderGeometry(.045,.06,.5,6),brass,{at:[0,.43,.72],rot:[-.35,0,0]});
  fittings.add(new THREE.BoxGeometry(1,.06,.06),dark,{at:[0,.7,.5]});
  // A caged rear duct and enclosed motor power the sled. There is deliberately
  // no fluid socket or backpack cradle on this vehicle.
  hull.add(new THREE.TorusGeometry(.58,.13,6,16),teal,{at:[0,.45,-1.18]});
  hull.add(new THREE.CylinderGeometry(.19,.23,.5,10),brass,{at:[0,.45,-1.24],rot:[Math.PI/2,0,0]});
  for (const a of [0,Math.PI/3,Math.PI*2/3]) fittings.add(new THREE.BoxGeometry(1.15,.035,.04),dark,{at:[0,.45,-1.36],rot:[0,0,a]});
  body.add(hull.mesh({smooth:true,metal:'painted'}),fittings.mesh({metal:'painted'}));
  const rotor = new THREE.Group(); rotor.position.set(0,.45,-1.24);
  const blades = new Paint();
  for (let i=0;i<4;i++) blades.add(new THREE.BoxGeometry(.49,.13,.035),brass,{at:[Math.cos(i*Math.PI/2)*.28,Math.sin(i*Math.PI/2)*.28,0],rot:[0,0,i*Math.PI/2+.25]});
  rotor.add(blades.mesh({metal:'painted'})); body.add(rotor);
  const seatAnchor = new THREE.Group(); seatAnchor.position.set(0,-.56,-.4); body.add(seatAnchor);
  root.traverse(o => {o.userData.noCollide=true;});
  return {root,body,seatAnchor,animate(dt,{speed=0}={}) {rotor.rotation.z += dt*(8+Math.abs(speed)*.35);}};
}
