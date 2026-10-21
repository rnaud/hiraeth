// The desert's bike is earned against a rider, not a target time.
import canyon, { COURSE, buildCanyon, start } from './canyon.js';
export default {
  ...canyon, id:'canyon-rival', name:"Kamal’s wager", order:3.1, rival:true,
  blurb:'Beat Kamal around the Two Chasms and keep the borrowed hoverbike.',
  rules:'One lap against Kamal. Both bikes start together and use the same physics. Follow the checkpoints, brake before bends, and take the kickers at full throttle. Win the bike; lose or quit and you can retry without a fee.',
  build:function*(scene,context){return yield* buildCanyon(scene,context,{...COURSE,laps:1});}, start,
};
