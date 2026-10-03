import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Controller, mergeControls, stick } from '../src/controller.js';
function setup() {
  const pad = { index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({length:17}, () => ({pressed:false,value:0})) };
  const actions = [], moves = [], looks = [];
  let context = 'game';
  const c = new Controller({ pads: () => [pad], context: () => context, action: a => actions.push(a), look: (...v) => looks.push(v), navigate: (...v) => moves.push(v), scroll: () => {} });
  return { c, pad, actions, moves, looks, context: v => context = v, button: (i, down) => { pad.buttons[i] = {pressed:down,value:+down}; } };
}
test('radial deadzone removes drift and preserves analog range', () => {
  assert.deepEqual(stick(.1,.1), {x:0,y:0});
  assert.equal(stick(1,0).x,1);
  assert.ok(stick(.5,0).x > 0 && stick(.5,0).x < .5);
  assert.ok(Math.hypot(...Object.values(stick(1,1))) <= 1.000001);
});
test('gameplay holds map to shared walking, climbing and vehicle controls', () => {
  const t=setup(); t.pad.axes=[.6,-1,.5,0]; [0,2,7].forEach(i=>t.button(i,true));
  const input=t.c.update(1/60);
  assert.ok(input.KeyW && input.KeyD && input.Space && input.KeyE && input.ShiftLeft);
  assert.ok(input.stick.y>0 && t.looks[0][0]>0);
  t.button(3,true); t.c.update(.016); t.c.update(.016);
  assert.deepEqual(t.actions,['ping']);
});
test('disconnect and background clear controls without releasing keyboard input', () => {
  const t=setup(); t.button(0,true); assert.ok(t.c.update(.016).Space);
  assert.deepEqual(t.c.update(.016,false),{});
  t.pad.connected=false; assert.deepEqual(t.c.update(.016),{});
  assert.ok(mergeControls({Space:true}, {Space:false}).Space);
  assert.deepEqual(mergeControls({stick:{x:.5,y:0}}, {stick:{x:0,y:0}}).stick,{x:.5,y:0});
});
test('confirm does not become a jump when returning to play', () => {
  const t=setup(); t.context('menu'); t.button(0,true); t.c.update(.016);
  assert.deepEqual(t.actions,['confirm']);
  t.context('game'); assert.equal(t.c.update(.016).Space,false);
  t.button(0,false); t.c.update(.016); t.button(0,true);
  assert.equal(t.c.update(.016).Space,true);
});
test('menu directions repeat with a delay and never move the player', () => {
  const t=setup(); t.context('menu'); t.button(13,true);
  assert.deepEqual(t.c.update(.016),{}); t.c.update(.1);
  assert.equal(t.moves.length,1); t.c.update(.31); assert.equal(t.moves.length,2);
});
test('photo controls capture once and use shoulders for altitude', () => {
  const t=setup(); t.context('photo'); [0,5].forEach(i=>t.button(i,true));
  assert.ok(t.c.update(.016).KeyE); t.c.update(.016);
  assert.deepEqual(t.actions,['capture']); t.button(1,true); t.c.update(.016);
  assert.deepEqual(t.actions,['capture','photo']);
});
