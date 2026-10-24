import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DESERT_TEMPLE, ROOMS as ROSE_ROOMS } from '../src/temples/desert.js';
import { BAZAAR_TEMPLE, ROOMS as MARKET_ROOMS } from '../src/temples/bazaar.js';
import { ARZACH_TEMPLE, FLEDGE } from '../src/temples/arzach.js';
import { mapDisplay } from '../src/temples/map-display.js';
import { BURIED_TEMPLE, EH, GALLERY } from '../src/temples/buried.js';
import { UNDERWATER_TEMPLE, ROOMS as POOLS } from '../src/temples/underwater.js';
import { ARZACH2_TEMPLE, ROOMS as BELFRY } from '../src/temples/arzach2.js';

import { ROSE_SKIN } from '../src/temples/skins/rose-house.js';
import { UNDERTOWER_SKIN } from '../src/temples/skins/undertower.js';
import { AERIE } from '../src/temples/skins/aerie.js';
import { WHALE_SKIN } from '../src/temples/skins/whale-house.js';
import { BELFRY_SKIN } from '../src/temples/skins/founders-belfry.js';

const DISPLAYS = [DESERT_TEMPLE, BAZAAR_TEMPLE, ARZACH_TEMPLE, BURIED_TEMPLE, UNDERWATER_TEMPLE, ARZACH2_TEMPLE];

test('all six raised map chests align with their local room axes', () => {
  for (const def of DISPLAYS) {
    const e = def.logic.elements.map;
    assert.equal(e.display.scale, 1.5);
    assert.ok(Math.abs(e.yaw / (Math.PI / 2) - Math.round(e.yaw / (Math.PI / 2))) < 1e-12, def.id);
  }
});

test('map display raises chest foot exactly to its visible/solid plinth top', () => {
  for(const def of DISPLAYS) {
    const { at, yaw } = def.logic.elements.map;
    const floor=[...at], d=mapDisplay(at,{scale:1.5,plinth:[1.8,.24,1.6]},yaw);
    d.plinth.computeBoundingBox();
    assert.deepEqual(at,floor,'authored floor position is not mutated');
    assert.ok(Math.abs(d.plinth.boundingBox.max.y-d.at[1])<1e-5);
    assert.ok(Math.abs(d.plinth.boundingBox.min.y-at[1])<1e-5);
    assert.equal(d.scale,1.5); d.plinth.dispose();
  }
  assert.deepEqual(mapDisplay([1,2,3]),{at:[1,2,3],scale:1,plinth:null});
});

test('display footprints stay on existing floors, clear of mandatory puzzle lanes', () => {
  const bounds=def=>{const {at,yaw,display}=def.logic.elements.map;const d=mapDisplay(at,display,yaw);d.plinth.computeBoundingBox();const b=d.plinth.boundingBox.clone();d.plinth.dispose();return b;};
  const desert=bounds(DESERT_TEMPLE);
  assert.ok(desert.min.z>54.6 && desert.max.z<63.2-2, 'no extension towards the mandatory double-jump pit');
  assert.ok(desert.max.x < -41.2-5,'entry/jump axis clear');
  const bazaar=bounds(BAZAAR_TEMPLE);
  assert.ok(bazaar.min.x>29 && bazaar.min.z>73);
  assert.ok(bazaar.max.z<84,'entry mark and z92 ball lane clear');
  assert.ok(bazaar.max.x<45.6-5,'key cage and horn not raised or obstructed');
  const aerie=bounds(ARZACH_TEMPLE);
  assert.ok(aerie.max.x < -1.8-3,'ball route has more than its radius plus player clearance');
  assert.ok(!aerie.intersectsBox(new THREE.Box3(new THREE.Vector3(-3.4,15,90.4),new THREE.Vector3(-.2,18,93.6))),'shaft remains untouched');
  assert.ok(aerie.max.z<112.6-4,'entrance clearance');
});

// Read the real authored definitions: a later placement edit must still satisfy
// these room constraints. This is a footprint check, not swept player proof.
test('next three authored displays stay on their original floors and off puzzle approaches', () => {
  const bounds = def => {
    const e = def.logic.elements.map;
    const d = mapDisplay(e.at, e.display, e.yaw);
    assert.equal(d.scale, 1.5);
    d.plinth.computeBoundingBox();
    const b = d.plinth.boundingBox.clone();
    assert.ok(Math.abs(b.min.y-e.at[1]) < 1e-5);
    assert.ok(Math.abs(b.max.y-d.at[1]) < 1e-5);
    d.plinth.dispose();
    return b;
  };
  const engine = bounds(BURIED_TEMPLE);
  assert.equal(BURIED_TEMPLE.logic.elements.map.room, 'gallery');
  assert.equal(BURIED_TEMPLE.logic.elements.map.at[1], 7);
  assert.ok(engine.min.z > GALLERY.north + .4 + 1.5, 'walk space behind the parapet');
  assert.ok(engine.max.z < EH.z1 - 1.5, 'walk space before the north wall');
  assert.ok(engine.min.x > GALLERY.gap + 1.5, 'piston landing and central bulkhead route clear');
  assert.ok(engine.max.x < EH.x1 - 1.5, 'not against the east wall');

  const pool = bounds(UNDERWATER_TEMPLE), wing = POOLS.wing;
  assert.equal(UNDERWATER_TEMPLE.logic.elements.map.room, 'pools');
  assert.equal(UNDERWATER_TEMPLE.logic.elements.map.at[1], 0);
  assert.ok(pool.min.x > POOLS.glass + 1.5, 'dry side, away from glass');
  assert.ok(pool.max.x < -wing.x + wing.w/2 - 1.5, 'east entry lane clear');
  assert.ok(pool.min.z > wing.z + 2 + 1.2 + 1.5, 'north of the entire ball groove and cradle');
  assert.ok(pool.max.z < wing.z + wing.d/2 - .7 - 1.5, 'north shelf clearance');

  const belfry = bounds(ARZACH2_TEMPLE), nave = BELFRY.nave;
  assert.equal(ARZACH2_TEMPLE.logic.elements.map.room, 'stair');
  assert.equal(ARZACH2_TEMPLE.logic.elements.map.at[1], nave.y);
  assert.ok(belfry.min.x > nave.x0 + 1.5 && belfry.max.x < -3, 'wall and central approach clear');
  assert.ok(belfry.min.z > nave.z0 + 1.5 && belfry.max.z < 70 - 1.5, 'below and south of the gallery');
});

// Match each actual skin's floor coordinates, not a generic world-space grid.
// Engine gallery is plain M.trim: no tile-centre assertion is invented for it.
test('five tiled map displays sit at their actual skin tile centres', () => {
  const fract = x => x - Math.floor(x);
  const centered = (x, origin, cell, phase = 0) => assert.ok(Math.abs(fract((x-origin)/cell+phase)-.5)<1e-10);
  const at = def => def.logic.elements.map.at;
  const rose = at(DESERT_TEMPLE), size = ROSE_SKIN.floor.size[0];
  const cell = [Math.floor(rose[0]/size),Math.floor(rose[2]/size)];
  const hash = (x,z) => fract(Math.sin(x*127.1+z*311.7)*43758.5453);
  const h = hash(cell[0]+1.7,cell[1]+1.7);
  const sub = h < .3 ? [1,1] : h < .65 ? (hash(cell[0]+3,cell[1]+3)<.5 ? [2,1] : [1,2]) : [2,2];
  assert.deepEqual(sub,[2,2],'chosen Rose cell has four real subtiles');
  centered(rose[0],cell[0]*size,size/sub[0]);centered(rose[2],cell[1]*size,size/sub[1]);
  for (const [def,grid] of [[BAZAAR_TEMPLE,UNDERTOWER_SKIN.floor.plate],[UNDERWATER_TEMPLE,WHALE_SKIN.floor.plate]]) {
    centered(at(def)[0],0,grid[0]);centered(at(def)[2],0,grid[1]);
  }
  centered(at(ARZACH_TEMPLE)[0],0,AERIE.floor.plate);
  centered(at(ARZACH_TEMPLE)[2],FLEDGE.z,AERIE.floor.plate);
  centered(at(ARZACH2_TEMPLE)[0],(BELFRY.nave.x0+BELFRY.nave.x1)/2,BELFRY_SKIN.plate[0],.5);
  centered(at(ARZACH2_TEMPLE)[2],(BELFRY.nave.z0+BELFRY.nave.z1)/2,BELFRY_SKIN.plate[0],.5);
});

test('each raised map chest has its back toward the nearest full room wall', () => {
  const wing = POOLS.wing;
  const cases = [
    [DESERT_TEMPLE,ROSE_ROOMS.channel,'south'],
    [BAZAAR_TEMPLE,MARKET_ROOMS.tune,'west'],
    [ARZACH_TEMPLE,{x0:-FLEDGE.w/2,x1:FLEDGE.w/2,z0:FLEDGE.z0,z1:FLEDGE.z1},'west'],
    [BURIED_TEMPLE,EH,'north'], // full outer wall, not the low gallery parapet
    [UNDERWATER_TEMPLE,{x0:-wing.x-wing.w/2,x1:-wing.x+wing.w/2,z0:wing.z-wing.d/2,z1:wing.z+wing.d/2},'north'],
    [ARZACH2_TEMPLE,BELFRY.nave,'south'],
  ];
  for (const [def,room,expected] of cases) {
    const {at:[x,,z],yaw}=def.logic.elements.map;
    const walls=[['west',x-room.x0,[-1,0]],['east',room.x1-x,[1,0]],['south',z-room.z0,[0,-1]],['north',room.z1-z,[0,1]]];
    const nearest=Math.min(...walls.map(w=>w[1]));
    // West wins the Aerie's exact west/north tie; no random approach-facing choice.
    const wall=walls.find(w=>Math.abs(w[1]-nearest)<1e-8);
    assert.equal(wall[0],expected,def.id);
    assert.ok((-Math.sin(yaw))*wall[2][0]+(-Math.cos(yaw))*wall[2][1] > 1-1e-10,def.id+' back points at wall');
  }
});
