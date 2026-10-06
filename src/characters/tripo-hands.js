// The digit joints are fitted before weight transfer. Keep the game's context,
// drift and wrist inertia, with a small finger reduction and limited thumb
// opposition while full contact grips remain under review.
export function updateTripoHands(humanoid,dt,motion,pose='auto'){
 if(motion==='rest'&&pose==='auto')return;
 if(pose!=='auto')humanoid.hands.set(pose);
 humanoid.hands.update(dt,{...(pose!=='auto'?{pose}:{}),mode:motion==='drive'?'seated':motion==='climbUp'?'climb':'ground',speed:motion==='walk'?1.4:motion==='jog'?3.8:0});
 softenTripoHands(humanoid);
}

export function softenTripoHands(humanoid){
 for(const hand of humanoid.hands.sides){
  for(const joint of hand.joints)joint.b.quaternion.slerp(joint.rest,.2);
  for(const joint of hand.thumb)joint.b.quaternion.slerp(joint.rest,.55);
  hand.hand.updateMatrixWorld(true);
 }
}
