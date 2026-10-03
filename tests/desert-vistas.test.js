import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BASIN,basinHeight,buildDesertVistas} from '../src/desert-vistas.js';
import {Physics} from '../src/physics.js';
test('basin changes only its local area and leaves a shallow walkable bed',()=>{
 const original=(x,z)=>x*.01+z*.02;
 assert.equal(basinHeight(0,0,original),original(0,0));
 assert.equal(basinHeight(BASIN.x,BASIN.z,original),original(BASIN.x,BASIN.z)-1.8);
});
test('bridge deck has continuous collision across the suspended span',()=>{
 const scene=new THREE.Scene(),terrain={heightAt:()=>0,baseAt:()=>0};
 const {bridge}=buildDesertVistas(scene,terrain),physics=new Physics(scene);
 for(let x=-60;x<=60;x+=2){const hit=physics.rayHit(new THREE.Vector3(bridge.x+x,40,bridge.z),new THREE.Vector3(0,-1,0),50);assert.ok(hit,`deck at ${x}`);assert.ok(hit.point.y>22);}
});
