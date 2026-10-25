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


import { PERDIDE2_TEMPLE, ROOMS as LAMP_ROOMS } from '../src/temples/perdide2.js';
import { GARAGE_TEMPLE, WING as CLOCK_WING } from '../src/temples/garage.js';
import { SPHERES_TEMPLE, ROOMS as FOOT_ROOMS } from '../src/temples/spheres.js';
import { LAMP_SKIN } from '../src/temples/skins/lamp-house.js';
import { CLOCK_SKIN } from '../src/temples/skins/clock-house.js';
import { FOOT } from '../src/temples/skins/footprint.js';

const NEXT_DISPLAYS = [PERDIDE2_TEMPLE, GARAGE_TEMPLE, SPHERES_TEMPLE];
test('Lamp, Clock and Footprint displays follow actual floor grids and back nearest walls', () => {
  const c = CLOCK_WING.strike;
  const cases = [
    [PERDIDE2_TEMPLE, LAMP_ROOMS.roots, [0,0], LAMP_SKIN.floor.plate, 0, 'west'],
    [GARAGE_TEMPLE, {x0:c.x-c.w/2,x1:c.x+c.w/2,z0:c.z-c.d/2,z1:c.z+c.d/2}, [c.x,c.z], [CLOCK_SKIN.plate[0],CLOCK_SKIN.plate[0]], .5, 'south'],
    [SPHERES_TEMPLE, FOOT_ROOMS.pool, [(FOOT_ROOMS.pool.x0+FOOT_ROOMS.pool.x1)/2,(FOOT_ROOMS.pool.z0+FOOT_ROOMS.pool.z1)/2], [FOOT.floor.plate,FOOT.floor.plate], 0, 'east'],
  ];
  const fract = v => v-Math.floor(v);
  for (const [def,room,origin,size,phase,expected] of cases) {
    const {at:[x,,z],yaw,display}=def.logic.elements.map;
    assert.deepEqual(display,{scale:1.5,plinth:[1.8,.24,1.6]});
    assert.ok(Math.abs(fract((x-origin[0])/size[0]+phase)-.5)<1e-10,def.id+' tile x');
    assert.ok(Math.abs(fract((z-origin[1])/size[1]+phase)-.5)<1e-10,def.id+' tile z');
    const walls=[['west',x-room.x0,[-1,0]],['east',room.x1-x,[1,0]],['south',z-room.z0,[0,-1]],['north',room.z1-z,[0,1]]];
    const chosen=walls.find(w=>w[0]===expected),nearest=Math.min(...walls.map(w=>w[1]));
    assert.ok(Math.abs(chosen[1]-nearest)<1e-8,def.id+' nearest wall (Footprint east wins tie)');
    assert.ok(-Math.sin(yaw)*chosen[2][0]-Math.cos(yaw)*chosen[2][1]>1-1e-10,def.id+' back points at wall');
  }
});

test('three new plinth footprints retain support and leave machinery and pool routes clear', () => {
  const bounds=def=>{const e=def.logic.elements.map,d=mapDisplay(e.at,e.display,e.yaw);d.plinth.computeBoundingBox();const b=d.plinth.boundingBox.clone();assert.ok(Math.abs(b.min.y-e.at[1])<1e-5);assert.ok(Math.abs(b.max.y-d.at[1])<1e-5);d.plinth.dispose();return b;};
  const lamp=bounds(PERDIDE2_TEMPLE),lr=LAMP_ROOMS.roots;
  assert.ok(lamp.min.x>lr.x0+1.5 && lamp.max.x< -13,'wall walkway and x-12 inscription remain clear');
  assert.ok(lamp.min.z>lr.z0+1.5 && lamp.max.z<lr.z0+lr.near-1.5,'near slab and pit boundary remain clear');
  assert.ok(lamp.max.y+2<9-.6,'full standing height below west return ledge');
  const clock=bounds(GARAGE_TEMPLE),c=CLOCK_WING.strike,t=CLOCK_WING.track;
  assert.ok(clock.min.z>c.z-c.d/2+1.5 && clock.max.z<t.z0-1.5,'south wall and hour track approach clear');
  assert.ok(clock.max.x<c.x+c.w/2-1.5 && clock.min.x>t.x+3.05+.25+1.5,'east wall and clock posts clear');
  const foot=bounds(SPHERES_TEMPLE),fr=FOOT_ROOMS.pool;
  assert.ok(foot.min.z>fr.z0+1.5 && foot.max.z<fr.z0+fr.near-1.5,'fully on near slab, not a pool shortcut');
  assert.ok(foot.max.x<fr.x1+1e-6 && foot.min.x>3.5+3.4/2+1.5,'bridge approach at x3.5 remains clear');
  assert.equal(SPHERES_TEMPLE.logic.elements.map.at[1],fr.ledge);
});


import { EDENA_TEMPLE, ROOMS as SEED_ROOMS } from '../src/temples/edena.js';
import { MOONFOUNDRY_TEMPLE } from '../src/temples/moonfoundry.js';
import { PERDIDE_TEMPLE, ROOMS as CHOIR_ROOMS } from '../src/temples/perdide.js';
import { CASTING } from '../src/temples/skins/casting-house.js';
import { HUSH } from '../src/temples/skins/hush-house.js';

// Edena uses the baked world-space kit floor; the other two skins use room centres.
// The Casting Stair omits its entry wall: that opening is not a nearest full wall.
test('Seed Vault, Casting Stair and Choir maps follow their floor tiles and face away from walls', () => {
  const cases = [
    [EDENA_TEMPLE, SEED_ROOMS.vault, [-EDENA_TEMPLE.origin[0],-EDENA_TEMPLE.origin[2]], 2.4, 'west', []],
    [MOONFOUNDRY_TEMPLE, {x0:-59,x1:-29,z0:48.2,z1:78.2}, [-44,63.2], CASTING.floor.plate, 'east', ['south']],
    [PERDIDE_TEMPLE, CHOIR_ROOMS.choir, [0,(CHOIR_ROOMS.choir.z0+CHOIR_ROOMS.choir.z1)/2], HUSH.floor.plate, 'west', []],
  ];
  for (const [def,room,origin,size,expected,omitted] of cases) {
    const {at:[x,y,z],yaw,display}=def.logic.elements.map;
    assert.equal(y,0); assert.deepEqual(display,{scale:1.5,plinth:[1.8,.24,1.6]});
    for (const [v,o] of [[x,origin[0]],[z,origin[1]]]) {
      const q=(v-o)/size;assert.ok(Math.abs(q-Math.floor(q)-.5)<1e-10,def.id+' actual tile centre');
    }
    const walls=[['west',x-room.x0,[-1,0]],['east',room.x1-x,[1,0]],['south',z-room.z0,[0,-1]],['north',room.z1-z,[0,1]]].filter(w=>!omitted.includes(w[0]));
    walls.sort((a,b)=>a[1]-b[1]);assert.equal(walls[0][0],expected,def.id);
    assert.ok(-Math.sin(yaw)*walls[0][2][0]-Math.cos(yaw)*walls[0][2][1]>1-1e-10,def.id+' back faces nearest full wall');
    const d=mapDisplay([x,y,z],display,yaw);d.plinth.computeBoundingBox();const b=d.plinth.boundingBox;
    assert.ok(b.min.x>room.x0 && b.max.x<room.x1 && b.min.z>room.z0 && b.max.z<room.z1,def.id+' fully supported footprint');
    assert.ok(Math.abs(b.min.y-y)<1e-5 && Math.abs(b.max.y-d.at[1])<1e-5);d.plinth.dispose();
  }
});

test('new map plinths stay clear of vault pots, the moving hoist and the tilted choir crystal', () => {
  const bounds=def=>{const e=def.logic.elements.map,d=mapDisplay(e.at,e.display,e.yaw);d.plinth.computeBoundingBox();const b=d.plinth.boundingBox.clone();d.plinth.dispose();return b;};
  const seed=bounds(EDENA_TEMPLE);
  // Authored solid pot rims (edena.js vault dressing), not just their vegetation.
  for(const [x,z,r] of [[-49.2,66.6,.84],[-45,62.1,.72]]) {
    const dx=Math.max(seed.min.x-x,0,x-seed.max.x),dz=Math.max(seed.min.z-z,0,z-seed.max.z);
    assert.ok(Math.hypot(dx,dz)>r+.45,'pot plus capsule-width separation');
  }
  assert.ok(seed.max.x< -39-3,'seed/weight plate approach remains clear');
  const casting=bounds(MOONFOUNDRY_TEMPLE);
  assert.ok(casting.min.x> -44+2.4+.45,'outside hoist/base envelope');
  assert.ok(casting.max.z<58.2-.45,'below upper landing approach');
  const choir=bounds(PERDIDE_TEMPLE);
  // Conservative envelope of the unchanged h6/r.9 crystal tilted .15 at[-19,35].
  assert.ok(choir.min.z>35+.9+6*Math.sin(.15)+.45,'plinth clears tilted crystal plus capsule radius');
  assert.ok(choir.max.z<50-.45,'west balcony approach remains clear');
  // Static footprint separation is not proof of an entire swept walk or jump.
});
