import {loadTravellerB3,createTravellerB3Steps} from './traveller-b3.js';
import {seatTripoArms} from './tripo-walk.js';
import {runSteps} from '../load-steps.js';
import {cleanExpression} from '../expression.js';
import {TRAVELLER} from '../traveller.js';

// Canonical playable traveller: game, title, studio and cinematics share B3.
export const loadTraveller=loadTravellerB3;
export function createTraveller(char,assets,options={}){return runSteps(createTravellerSteps(char,assets,options))}
export function* createTravellerSteps(char,assets,options={}){
 const model=yield* createTravellerB3Steps(char,assets,options),h=model.humanoid;
 const fitArms=model.poseArms.bind(model);
 model.beltHook=false;
 model.shadowCasters=model.cloth.shadow?[model.cloth.shadow]:[];
 model.poseArms=player=>{
  const w=player.animator?.w;
  const active=w&&player.onGround&&!player.ride&&!player.aim&&!player.overlay&&
   !player.climbing&&!player.mantle&&!player.swim&&!player.gliding&&!player.thrusting&&!player.boarding;
  if(!active)return [];
  const jog=(w.jog??0)+(w.sprint??0);
  return fitArms('ground',jog,{walk:w.walk??0,jog});
 };
 // The live callers pass arm corrections with the anatomical wrist pose. Other
 // Humanoid consumers (get-up, title stance) still get the fitted hand frames.
 h.poseHands=animator=>model.poseHands(animator);
 model.poseRiding=player=>{model.poseProceduralHands();if(player.ride?.kind==='taxi')seatTripoArms(h,'drive',model.seatedFit)};
 model.updateHands=()=>{}; // shared Hands already uses this body's calibrated poses
 h.restExpression=cleanExpression(TRAVELLER.rest);h.setExpression(h.restExpression);
 h.wearGlove(model.mesh);
 h.tankAt=[0,.4,-.1886];
 return model;
}
