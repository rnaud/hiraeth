import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BASIN,BASIN_CUT,basinHeight,buildDesertVistas} from '../src/desert-vistas.js';
import {Physics} from '../src/physics.js';
test('basin changes only its local area and leaves a shallow walkable bed',()=>{
 const original=(x,z)=>x*.01+z*.02;
 assert.equal(basinHeight(0,0,original),original(0,0));
 assert.equal(basinHeight(BASIN.x,BASIN.z,original),original(BASIN.x,BASIN.z)-BASIN_CUT.depth);
});
test('the basin\'s water sits in its cut, not on the sand (issue #200)',()=>{
 // a gently rolling crust round it (±0.3 m), as the desert's is there
 const ground=(x,z)=>0.3*Math.sin(x*.05)*Math.cos(z*.07);
 const scene=new THREE.Scene(),terrain={heightAt:(x,z)=>basinHeight(x,z,ground),baseAt:(x,z)=>basinHeight(x,z,ground)};
 const {basin}=buildDesertVistas(scene,terrain);
 // the water stands under the crust round the basin, and still wades (under 1.3 m at the middle)
 assert.ok(basin.y<ground(BASIN.x,BASIN.z)-0.5,`water ${basin.y.toFixed(2)} under the crust`);
 assert.ok(basin.y-terrain.heightAt(BASIN.x,BASIN.z)<1.3,'wadeable');
 // the sheet's edge, all the way round, is under the bank (the ground over it by half a metre or more): no edge in the air
 let least=Infinity;
 for(let i=0;i<64;i++){const a=i/64*Math.PI*2,x=BASIN.x+Math.cos(a)*BASIN.rx*BASIN_CUT.sheet,z=BASIN.z+Math.sin(a)*BASIN.rz*BASIN_CUT.sheet;least=Math.min(least,terrain.heightAt(x,z)-basin.y);}
 assert.ok(least>0.5,`the bank over the sheet's edge by ${least.toFixed(2)} m`);
 // and a shore: open water out to over half the basin's radii, a bank of a few metres, not a long flat sheet
 const at=(r)=>terrain.heightAt(BASIN.x+BASIN.rx*r,BASIN.z)-basin.y;
 assert.ok(at(0.5)<0,'open water at half the radius');
 assert.ok(at(0.72)>0.5,'the bank top by 0.72 of it');
});
test('bridge deck has continuous collision across the suspended span',()=>{
 const scene=new THREE.Scene(),terrain={heightAt:()=>0,baseAt:()=>0};
 const {bridge}=buildDesertVistas(scene,terrain),physics=new Physics(scene);
 for(let x=-60;x<=60;x+=2){const hit=physics.rayHit(new THREE.Vector3(bridge.x+x,40,bridge.z),new THREE.Vector3(0,-1,0),50);assert.ok(hit,`deck at ${x}`);assert.ok(hit.point.y>22);}
});
