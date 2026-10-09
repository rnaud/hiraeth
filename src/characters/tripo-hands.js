// The digit joints are fitted before weight transfer. Keep the game's context, drift and wrist
// inertia; the generated thumb takes less of each pose (its opposition is limited while full contact
// grips remain under review). The fingers' fitted joints are straightened at rest by src/hands.js.
export const TRIPO_REACH = { fingers: 1, thumb: 0.45 };

export function updateTripoHands(humanoid,dt,motion,pose='auto'){
 if(motion==='rest'&&pose==='auto')return;
 if(pose!=='auto')humanoid.hands.set(pose);
 humanoid.hands.update(dt,{...(pose!=='auto'?{pose}:{}),mode:motion==='drive'?'seated':motion==='climbUp'?'climb':'ground',speed:motion==='walk'?1.4:motion==='jog'?3.8:0});
 softenTripoHands(humanoid);
}

/**
 * The traveller's share of each pose, written onto the fingers (Hands.reach, part of every write). It
 * used to slerp the finger bones 20% (the thumb 55%) back toward the rig's rest each call: harmless once
 * a frame after Hands.update, but on the pages that don't drive the hands (the title, the Motion page,
 * the trailer) it was the only thing writing them, and the fingers sank frame by frame into the fitted
 * rig's rest, bent back. Now the same however often it is called.
 */
export function softenTripoHands(humanoid){
 const hands=humanoid.hands;
 if(!hands)return;
 Object.assign(hands.reach,TRIPO_REACH);
 hands.apply();
}
