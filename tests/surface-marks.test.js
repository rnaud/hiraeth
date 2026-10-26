// The surface marks of issues #669 and #677 (src/surface-marks.js): interiors, sheet-metal walls, worked timber and the
// ground's middle distance; sea walls, pale stone, the buried city, panelled domes and water channels: each option as its
// uniforms, each compiled only where asked (its S_* define), and the Unity port's copy of the GLSL current and wired.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INTERIOR, SEA_WALL, PALE_STONE, BURIED_CITY, DOMES, CHANNEL, interiorOf, sheetOf, timberOf, groundMidOf, seaWallOf, paleStoneOf, buriedCityOf, domesOf, channelOf, MARKS_GLSL } from '../src/surface-marks.js';
import { makeMaterial, surfaceDefines, MODE_TERRAIN, MODE_WATER } from '../src/materials.js';
import { marksHlsl, MARKS_HLSL_PATH } from '../scripts/unity-export/marks-hlsl.mjs';
import { inkSpec } from '../engine/ink-spec.js';
import { portMaterial } from '../engine/unity/port-format.js';

const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);

test('interiors: the dado a darker band of the wall\'s own colour, the skirting paler toward cream, both optional', () => {
  const [r, dado, skirt] = interiorOf({ color: '#808080', interior: true });
  assert.deepEqual(r, [INTERIOR.tile, INTERIOR.dado, INTERIOR.skirt, INTERIOR.odd]);
  const g = 128 / 255;
  assert.ok(near(dado, [g * INTERIOR.dadoDark, g * INTERIOR.dadoDark, g * INTERIOR.dadoDark, 1]));
  assert.ok(near(skirt.slice(0, 3), INTERIOR.skirtCream.map((c) => g + (c - g) * INTERIOR.skirtMix)));
  const [r2, d2] = interiorOf({ color: '#808080', interior: { dadoColor: null, skirtColor: '#ff0000', tile: 0.4 } });
  assert.deepEqual([r2[0], r2[1], d2[3]], [0.4, 0, 0], 'no dado asked: none');
  for (const o of [{}, { interior: true, glass: true }, { interior: true, mode: MODE_TERRAIN }, { interior: true, glow: 1 }]) assert.equal(interiorOf({ color: '#fff', ...o })[0][0], 0);
});

test('sheet metal, timber and the ground\'s middle distance: their options as uniforms', () => {
  assert.deepEqual(sheetOf({ sheet: true }), [1.6, 1.25, 1, 1]);
  assert.deepEqual(sheetOf({ sheet: { panel: [2, 1], rust: 3, repaint: 0 } }), [2, 1, 2, 0]);
  assert.deepEqual(timberOf({ timber: true }), [0.24, 1, 0.1, 1]);
  assert.deepEqual(timberOf({ timber: { plank: 0, post: true, axis: 'x' } }), [0, 0, 0.1, 2]);
  assert.deepEqual(groundMidOf({ groundMid: true, mode: MODE_TERRAIN }), [3, 0.45, 1, 1]);
  assert.deepEqual(groundMidOf({ groundMid: true }), [0, 0, 0, 0], 'terrain only');
  assert.deepEqual(sheetOf({ sheet: true, mode: MODE_WATER }), [0, 0, 0, 0]);
});

test('each mark compiled only into the materials that ask for it, its uniforms set', () => {
  const plain = Object.keys(surfaceDefines({ color: '#fff' }));
  for (const d of ['S_INTERIOR', 'S_SHEET', 'S_TIMBER', 'S_GROUNDMID']) assert.ok(!plain.includes(d));
  assert.ok('S_INTERIOR' in surfaceDefines({ color: '#fff', interior: true }));
  assert.ok('S_SHEET' in surfaceDefines({ color: '#fff', sheet: true }));
  assert.ok('S_TIMBER' in surfaceDefines({ color: '#fff', timber: true }));
  assert.ok('S_GROUNDMID' in surfaceDefines({ color: '#fff', mode: MODE_TERRAIN, groundMid: true }));
  const m = makeMaterial({ color: '#9a6a4a', timber: { plank: 0.3 } });
  assert.deepEqual(m.uniforms.uTimber.value.toArray(), [0.3, 1, 0.1, 1]);
  assert.match(m.fragmentShader, /float timber\(vec3 p, int face, vec3 pf, float ny, inout vec3 alb\)/);
  // (o.room is the ship's rooms' key light, ROOM_LIGHT: never this)
  assert.equal(makeMaterial({ color: '#9a6a4b', room: { value: { x: 0, y: 1, z: 0, w: 1 } } }).uniforms.uInterior.value.x, 0);
});

test('the marks reach the Unity port: SurfaceMarks.hlsl made from the GLSL, the uniforms in the material\'s record', () => {
  assert.equal(readFileSync(MARKS_HLSL_PATH, 'utf8'), marksHlsl(), 'SurfaceMarks.hlsl is out of date: node scripts/unity-export/marks-hlsl.mjs');
  assert.ok(!/\b(vec[234]|mix|fract|uInterior\w*|uSheet|uTimber|uGroundMid|uSeaWall|uPaleStone|uBuried|uDomes\w*|uChannel)\b/.test(marksHlsl().replace(/\/\/.*$/gm, '')), 'no GLSL left in it');
  assert.equal(MARKS_GLSL.length, 9);
  const p = portMaterial(inkSpec(makeMaterial({ color: '#c0c0c0', sheet: true, timber: true, interior: true })), 5);
  assert.deepEqual(p.sheet, [1.6, 1.25, 1, 1]);
  assert.deepEqual(p.timber, [0.24, 1, 0.1, 1]);
  assert.equal(p.interior[0], INTERIOR.tile);
  assert.equal(p.interiorDado.length, 4);
  const shader = readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader', import.meta.url), 'utf8');
  assert.match(shader, /#include "SurfaceMarks\.hlsl"/);
  for (const f of ['interiorFloor(', 'sheetWall(', 'timber(i.objPos', 'groundMid(gp', 'groundMidTone(']) assert.ok(shader.includes(f), f);
  const loader = readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Runtime/WorldLoader.cs', import.meta.url), 'utf8');
  for (const k of ['interior', 'interiorDado', 'interiorSkirt', 'sheet', 'timber', 'groundMid']) assert.ok(loader.includes(`("${k}", "_${k[0].toUpperCase()}${k.slice(1)}", Vector4.zero)`), k);
});

test('issue #677: sea walls, pale stone, the buried city, domes and channels as their uniforms', () => {
  assert.deepEqual(seaWallOf({ seaWall: true }), [SEA_WALL.tide, 0, 1, 1]);
  assert.deepEqual(seaWallOf({ seaWall: { foot: -50, tide: 2, salt: 5 } }), [2, -50, 2, 1]);
  assert.deepEqual(paleStoneOf({ paleStone: true }), [PALE_STONE.course, PALE_STONE.block, 0, 1]);
  assert.deepEqual(paleStoneOf({ paleStone: { course: 1.5, block: 3, foot: 2.5, wear: 0.6 } }), [1.5, 3, 2.5, 0.6]);
  assert.deepEqual(buriedCityOf({ buriedCity: { foot: 2600 } }), [BURIED_CITY.band, 2600, BURIED_CITY.sand, 1]);
  assert.equal(buriedCityOf({ buriedCity: { sand: 0 } })[2], 0, 'no sand line asked: none');
  const [d, band] = domesOf({ domes: { band: '#5fb7ad', share: 0.2 } });
  assert.deepEqual(d, [DOMES.rings, DOMES.panels, DOMES.scour, 1]);
  assert.ok(near(band, [0x5f / 255, 0xb7 / 255, 0xad / 255, 0.2]));
  assert.deepEqual(domesOf({ domes: { tower: true } })[0], [DOMES.tower[0], DOMES.tower[1], DOMES.scour, 2], 'a tower: rings every few metres');
  assert.deepEqual(domesOf({ domes: true })[1], [0, 0, 0, 0], 'no band asked: none');
  assert.deepEqual(channelOf({ channel: { axis: 'z' }, mode: MODE_WATER }), [CHANNEL.half, 1, CHANNEL.flow, 1], 'a channel is drawn on water');
  assert.deepEqual(channelOf({ channel: { axis: 'x', half: 0.5 } }), [0.5, 0, CHANNEL.flow, 1]);
  // never on glass, lights, figures; the walls' never on the terrain
  for (const o of [{ glass: true }, { glow: 1 }, { figure: true }]) {
    assert.equal(seaWallOf({ seaWall: true, ...o })[0], 0);
    assert.equal(channelOf({ channel: true, ...o })[3], 0);
  }
  for (const f of [seaWallOf, paleStoneOf, buriedCityOf]) assert.equal(f({ seaWall: true, paleStone: true, buriedCity: true, mode: MODE_TERRAIN })[0], 0);
  assert.equal(domesOf({ domes: true, mode: MODE_TERRAIN })[0][3], 0);
});

test('issue #677: each compiled only where asked, its uniforms set, and the port carries them', () => {
  const plain = Object.keys(surfaceDefines({ color: '#fff' }));
  for (const d of ['S_SEAWALL', 'S_PALESTONE', 'S_BURIED', 'S_DOMES', 'S_CHANNEL']) assert.ok(!plain.includes(d), d);
  assert.ok('S_SEAWALL' in surfaceDefines({ color: '#fff', seaWall: true }));
  assert.ok('S_PALESTONE' in surfaceDefines({ color: '#fff', paleStone: true }));
  assert.ok('S_BURIED' in surfaceDefines({ color: '#fff', buriedCity: true }));
  assert.ok('S_DOMES' in surfaceDefines({ color: '#fff', domes: true }));
  assert.ok('S_CHANNEL' in surfaceDefines({ color: '#7fc4d0', mode: MODE_WATER, channel: true }));
  const m = makeMaterial({ color: '#f6efe0', domes: { band: '#e6875f', share: 0.2 } });
  assert.deepEqual(m.uniforms.uDomes.value.toArray(), [DOMES.rings, DOMES.panels, DOMES.scour, 1]);
  assert.match(m.fragmentShader, /float domes\(vec3 p, float fphi, float frc, float mpp, inout vec3 alb\)/);
  const p = portMaterial(inkSpec(makeMaterial({ color: '#c8c0b0', seaWall: { foot: 1 }, paleStone: true, buriedCity: true, domes: { band: '#ffffff' } })), 6);
  assert.deepEqual(p.seaWall, [SEA_WALL.tide, 1, 1, 1]);
  assert.deepEqual(p.paleStone, [PALE_STONE.course, PALE_STONE.block, 0, 1]);
  assert.deepEqual(p.buried, [BURIED_CITY.band, 0, BURIED_CITY.sand, 1]);
  assert.deepEqual(p.domes, [DOMES.rings, DOMES.panels, DOMES.scour, 1]);
  assert.equal(p.domesBand.length, 4);
  assert.deepEqual(portMaterial(inkSpec(makeMaterial({ color: '#7fc4d1', mode: MODE_WATER, channel: { axis: 'z' } })), 7).channel, [CHANNEL.half, 1, CHANNEL.flow, 1]);
  const shader = readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader', import.meta.url), 'utf8');
  for (const f of ['seaWall(i.worldPos', 'paleStone(i.worldPos', 'buriedCity(i.worldPos', 'channel(i.objPos', 'domes(i.objPos', 'domesRing(i.objPos)']) assert.ok(shader.includes(f), f);
  const loader = readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Runtime/WorldLoader.cs', import.meta.url), 'utf8');
  for (const [k, u] of [['seaWall', '_SeaWall'], ['paleStone', '_PaleStone'], ['buried', '_Buried'], ['domes', '_Domes'], ['domesBand', '_DomesBand'], ['channel', '_Channel']]) assert.ok(loader.includes(`("${k}", "${u}", Vector4.zero)`), k);
  const bridge = readFileSync(new URL('../unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs', import.meta.url), 'utf8');
  for (const u of ['_SeaWall', '_PaleStone', '_Buried', '_Domes', '_Channel']) assert.ok(bridge.includes(`V(m, "${u}")`), `${u} keeps a material off the plain variant`);
});
