// The desert's bike is earned against a rider, not a target time.
import canyon, { COURSE, buildCanyon, start } from './canyon.js';
export default {
  ...canyon, id:'canyon-rival', name:"Kamal’s wager", order:3.1, rival:true,
  blurb:'Beat Kamal around the Two Chasms and keep the borrowed hoverbike.',
  rules:'One lap: your fluid-powered hoverbike against Kamal’s motor-driven fan sled. Follow the checkpoints, brake before bends, and take the kickers at full throttle. Win and keep the bike. Lose and Kamal claims the bike and backpack, lending you the tank for a rematch.',
  build:function*(scene,context){return yield* buildCanyon(scene,context,{...COURSE,laps:1});}, start,
};
