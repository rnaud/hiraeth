// The application facades preserve default discovery while focused consumers use the same pure implementations.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as app from '../src/minigames/index.js';
import * as core from '../src/minigames/kit/registry.js';
import * as marker from '../src/minigames/kit/marker.js';
import * as markerCore from '../src/minigames/kit/marker-core.js';
import { allInteractables } from '../src/interact.js';

test('the catalogue facade exports the tested definitions and preserves default and explicit lookup',()=>{
 for(const name of ['REQUIRED','checkGame','collectGames','gameHref'])assert.equal(app[name],core[name],name);
 const game={id:'catalogue-contract',name:'Contract',blurb:'Check',rules:'Check',start(){},world:'arena'};
 app.GAMES.push(game);
 try{
  assert.equal(app.gameById(game.id),game);
  assert.equal(app.gameById(game.id,undefined),game);
  assert.equal(app.gameById(game.id,[]),null);
  assert.equal(core.gameById(game.id,[game]),game);
  assert.equal(core.gameById(game.id),null,'the pure lookup has no implicit catalogue');
  assert.throws(()=>app.gameById(game.id,null),TypeError,'invalid explicit lists keep their error');
 }finally{app.GAMES.splice(app.GAMES.indexOf(game),1);}
});

test('marker composition keeps default discovery, explicit overrides, placement and cleanup',()=>{
 assert.equal(marker.gameMarkerModel,markerCore.gameMarkerModel);
 assert.equal(marker.signPlate,markerCore.signPlate);
 const model=name=>()=>{const g=new THREE.Group();g.name=name;return g;};
 const game={id:'catalogue-marker-contract',name:'Contract',marker:{model:model('default')}};
 const custom={...game,marker:{model:model('custom')}};
 app.GAMES.push(game);
 const world={scene:new THREE.Scene(),levelId:'arena',lights:[]},pos=new THREE.Vector3(2,3,4),made=[];
 try{
  for(const options of [{host:false},{host:false,games:undefined},{host:false,games:[custom]}]){
   const placed=marker.placeGameMarker(world,game.id,pos,{heading:0.4,...options});made.push(placed);
   assert.deepEqual(placed.object.position.toArray(),pos.toArray());
   assert.equal(placed.object.rotation.y,0.4);
   assert.equal(placed.object.name,options.games?'custom':'default');
  }
  assert.equal(world.scene.children.length,3);
  assert.equal(world.lights.length,3);
  assert.throws(()=>marker.placeGameMarker(world,game.id,pos,{host:false,games:[]}),/no minigame/);
  assert.throws(()=>markerCore.placeGameMarker(world,game.id,pos,{host:false}),/no minigame/);
  assert.throws(()=>marker.placeGameMarker(world,game.id,pos,null),TypeError);
 }finally{
  for(const placed of made)placed.remove();
  app.GAMES.splice(app.GAMES.indexOf(game),1);
 }
 assert.equal(world.scene.children.length,0);
 assert.equal(world.lights.length,0);
 assert.ok(!allInteractables().some(x=>x.id==='minigame.'+game.id));
});


test('marker options keep inherited properties supported by the original destructured API',()=>{
 const game={id:'inherited-marker-contract',name:'Contract',marker:{model:()=>new THREE.Group()}};
 const world={scene:new THREE.Scene(),levelId:'arena',lights:[]};
 const options=Object.create({games:[game],heading:0.25,plate:null,host:false});
 const placed=marker.placeGameMarker(world,game.id,[1,2,3],options);
 try{
  assert.deepEqual(placed.object.position.toArray(),[1,2,3]);
  assert.equal(placed.object.rotation.y,0.25);
 }finally{placed.remove();}
 assert.equal(world.scene.children.length,0);
 assert.equal(world.lights.length,0);
});
