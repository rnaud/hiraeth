import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { quiet } from './built-worlds.js';
import { Ship } from '../src/ship/ship.js';
import { PrologueDirector } from '../src/ship/cinematics.js';
import { game } from '../src/game-state.js';
import { SITE_OVERRIDES, LEGACY_DESERT_SITE, CONTROLLED_LANDING_FLAG, probeSite } from '../src/ship/sites.js';
import * as caravanLayout from '../src/ship/caravan-layout.js';
import { Player } from '../src/player.js';
import { createDesert } from '../src/levels/desert.js';
import { Physics } from '../src/physics.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
function freshWorld(){const scene=new THREE.Scene();const level=quiet(()=>createDesert(scene));const physics=new Physics(scene,level.ground);quiet(()=>level.init?.(physics));return {scene,level,physics};}

test('controlled first berth stands in front of the camps, the gate and the tree straight ahead, and fits both ships on real Desert terrain',async()=>{
  const w=freshWorld(), site=SITE_OVERRIDES.desert, gate={x:195.1,z:339.3}, camps=w.level.qanat.camps.center;
  assert.ok(Math.hypot(site.x-gate.x,site.z-gate.z)<115,'well within the legacy berth\'s 220 m');
  assert.ok(Math.hypot(site.x-230,site.z-400)>66+35,'outside city and ship clearance');
  // issue #706: down the ramp, the camps' lane to the gate runs straight ahead (no turn round the walls to the left)
  const toGate=Math.atan2(gate.x-site.x,gate.z-site.z), toCamps=Math.atan2(camps.x-site.x,camps.z-site.z);
  assert.ok(Math.abs(site.heading-toGate)<0.05&&Math.abs(site.heading-toCamps)<0.08,'the hatch faces the camps and the gate behind them');
  for(const layout of [undefined,caravanLayout]) {
    const p=probeSite(w.physics,site.x,site.z,site.heading,{refY:w.level.ground.heightAt(site.x,site.z),...(layout?{layout}:{})});
    assert.ok(p,'hull, overhead and ramp probes clear actual scene');
    assert.ok(p.spread<2,'flat ground: under 2 m across the 52 m hull');
  }
});

for(const authored of [false,true])test(`real ${authored?'caravan':'fallback'} director approaches under power and lands without a skid`,async()=>{
  const w=freshWorld();let caravan=null;
  if(authored){const b=readFileSync(new URL('../public/models/ships/caravan-a/playable.glb',import.meta.url));caravan=(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;}
  game.set('prologue.done',false);game.set(CONTROLLED_LANDING_FLAG,false);
  const ship=quiet(()=>new Ship({...w,levelId:'desert',content:{npcs:[],relics:{spots:[]}},prologue:true,caravan}));
  assert.equal(game.flag(CONTROLLED_LANDING_FLAG),true);
  assert.equal(ship.crashed,false);assert.equal(ship.crashSite,undefined);
  assert.ok(ship.restPos.y>w.level.ground.heightAt(ship.site.x,ship.site.z));
  assert.ok((ship.hinge.y-ship.rampFoot.y)/ship.hinge.clone().sub(ship.rampFoot).setY(0).length()<.52,'ramp walkable');
  ship.player=new Player(w.physics);ship.sound={};ship.rig={yaw:0,pitch:.2,target:V(),clearYaw:(_,yaw)=>yaw};
  const d=new PrologueDirector(ship);d.enter('glide');assert.equal(ship.powerOf(ship.parked),'emergency');
  let emitted=0;const mouths=new Set(), emit=ship.jets.emit.bind(ship.jets);
  ship.jets.emit=(...a)=>{
    emitted++;
    if(authored){
      const local=a[0].clone().applyMatrix4(ship.parked.group.matrixWorld.clone().invert());
      const index=caravanLayout.BOOSTER_CENTRES.findIndex(b=>local.distanceTo(b.at)<1);
      assert.ok(index>=0,'flame originates at an authored rear mouth, never the belly');mouths.add(index);
      const direction=a[1].clone().normalize().applyQuaternion(ship.parked.group.quaternion.clone().invert());
      assert.ok(direction.z>.99,'exhaust points aft in ship space');
    }
    return emit(...a);
  };
  let last=null;
  for(let i=0;i<=312;i++){
    d.frame('glide',i/60,1/60);const p=ship.parked.group.position;
    assert.ok(p.y>=w.level.ground.heightAt(p.x,p.z)+ship.layout.LIFT,'above terrain throughout approach');
    if(last)assert.ok(p.distanceTo(last)<2,'bounded approach speed');last=p.clone();
  }
  assert.ok(emitted>100,'reserve engines visibly active through approach');
  if(authored)assert.equal(mouths.size,4,'all four rear mouths emit');
  assert.ok(last.distanceTo(d.touch)<1e-6);
  d.enter('land');let y=last.y;
  for(let i=0;i<=216;i++){
    d.frame('land',i/60,1/60);const p=ship.parked.group.position;
    assert.ok(Math.hypot(p.x-ship.restPos.x,p.z-ship.restPos.z)<1e-6,'no horizontal ground skid');
    assert.equal(ship.parked.rampK,0,'camp remains packed throughout touchdown');
    assert.ok(p.y<=y+1e-8&&p.y>=ship.restPos.y-1e-8,'smooth monotone descent');y=p.y;
  }
  assert.ok(ship.parked.group.position.distanceTo(ship.restPos)<1e-6);
  assert.equal(ship.parked.gearAltitude,0,'gear fully extended at rest');
  assert.ok(ship.parked.group.quaternion.angleTo(ship.restQuat)<1e-6);
  d.bot.dispose();ship.removeSpaceCopy();
});

test('pre-change completed saves retain their old berth; controlled saves retain their new berth',()=>{
  game.set('prologue.done',true);game.set(CONTROLLED_LANDING_FLAG,false);
  for(const [flag,want] of [[false,LEGACY_DESERT_SITE],[true,SITE_OVERRIDES.desert]]){
    const w=freshWorld();game.set(CONTROLLED_LANDING_FLAG,flag);
    const s=quiet(()=>new Ship({...w,levelId:'desert',content:{npcs:[],relics:{spots:[]}}}));
    assert.equal(s.site.x,want.x);assert.equal(s.site.z,want.z);
    assert.equal(s.crashed,!flag);
    const spot=s.roomSpot('cabin');assert.ok(spot.pos.toArray().every(Number.isFinite));
  }
  game.set('prologue.done',false);game.set(CONTROLLED_LANDING_FLAG,false);
});


test('new debug saves use the current berth while genuine older saves retain theirs', async () => {
  const { progressBefore } = await import('../src/debug-save.js');
  const flags = progressBefore('desert').flags;
  assert.equal(flags[CONTROLLED_LANDING_FLAG], true);
  const previous = game.data.flags;
  try {
    game.data.flags = { ...flags };
    const w = freshWorld();
    const ship = quiet(() => new Ship({ ...w, levelId: 'desert', content: { npcs: [], relics: { spots: [] } } }));
    assert.equal(ship.site.x, SITE_OVERRIDES.desert.x);
    assert.equal(ship.site.z, SITE_OVERRIDES.desert.z);
    assert.ok(w.level.spawn.distanceTo(ship.rampFoot) < 20, 'debug spawn and real ship share the new berth');
  } finally { game.data.flags = previous; }
});


test('controlled landing keeps a lit return route, nearby first fragments and the House return landmark', async () => {
  const { FRAGMENTS, FRAGMENT_PLACES } = await import('../src/fragments-data.js');
  const { pointsOfInterest, onPlace, wetAt } = await import('./fragments-reach.js');
  const { Waters } = await import('../src/water.js');
  const previous = game.data.flags;
  try {
    game.data.flags = { 'prologue.done': true, [CONTROLLED_LANDING_FLAG]: true };
    const world = freshWorld(), { level, physics } = world, C = level.road.cairns, spawn = level.spawn;
    const pois=pointsOfInterest(world,'desert'), waters=new Waters(world.scene,{physics});
    assert.ok(C.at(-1).at.clone().sub(spawn).setY(0).length() < 40);
    for (let i=1;i<C.length;i++) assert.ok(C[i].at.distanceTo(C[i-1].at)<60, `visible next cairn ${i}`);
    const near=FRAGMENTS.desert.map(p=>Math.hypot(p[0]-spawn.x,p[2]-spawn.z)).filter(d=>d<70);
    assert.ok(near.length>=2 && Math.min(...near)<45);
    for(const i of [5,6]) { const [x,y,z]=FRAGMENTS.desert[i];assert.ok(Math.abs(physics.groundAt(x,y+3,z,8)-y)<.5, `fragment ${i} stands on terrain`);assert.ok(pois.some(p=>p.name===FRAGMENT_PLACES.desert[i] && onPlace(p,x,y,z,physics)), `fragment ${i} belongs to its named cairn`);assert.equal(wetAt(waters,x,y,z),false, `fragment ${i} is dry`); }
    const f=level.fieldStone.at,d=level.temple.outside.door.at;
    const off=Math.abs((f.x-spawn.x)*(d.z-spawn.z)-(f.z-spawn.z)*(d.x-spawn.x))/Math.hypot(d.x-spawn.x,d.z-spawn.z);
    assert.ok(off<30, `field-stone on new return route (${off})`);
  } finally { game.data.flags=previous; }
});
