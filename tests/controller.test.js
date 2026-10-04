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
test('the fluid tool: LT aims, RT shoots only while aiming (instead of running), B pushes', () => {
  const t=setup(); t.button(7,true);
  let input=t.c.update(.016);
  assert.ok(input.ShiftLeft && !input.PadFire && !input.PadAim, 'RT alone still runs');
  t.button(6,true); input=t.c.update(.016);
  assert.ok(input.PadAim && input.PadFire && !input.ShiftLeft);
  t.button(10,true); assert.ok(t.c.update(.016).ShiftLeft, 'L3 can still run while aiming');
  t.button(1,true); assert.ok(t.c.update(.016).PadPush, 'B pushes');
  const b=setup(); b.button(1,true); input=b.c.update(.016);
  assert.ok(input.PadPush && !input.PadAim, 'B pushes without aiming too');
  b.button(1,false); b.button(14,true); input=b.c.update(.016);
  assert.ok(!input.PadPush && input.PadModePrev && !input.PadModeNext, 'D-pad left: the previous gun mode');
  b.button(14,false); b.button(15,true); input=b.c.update(.016);
  assert.ok(input.PadModeNext && !input.PadModePrev, 'D-pad right: the next one');
  // a light squeeze of LT is enough to aim
  const s=setup(); s.pad.buttons[6]={pressed:false,value:.35}; assert.ok(s.c.update(.016).PadAim);
  // no aiming or firing from menus
  const m=setup(); m.context('menu'); [6,7,1].forEach(i=>m.button(i,true)); assert.deepEqual(m.c.update(.016),{});
  assert.ok(mergeControls({KeyR:true},{PadAim:false}).KeyR);
  assert.ok(mergeControls({},{PadFire:true}).PadFire);
});

test('in menus B steps back, Menu / Start and View / Select reach the game (pause menu, sketchbook)', () => {
  const t=setup(); t.context('menu');
  t.button(1,true); t.c.update(.016); t.button(1,false); t.c.update(.016);
  t.button(9,true); t.c.update(.016); t.button(9,false); t.c.update(.016);
  t.button(8,true); t.c.update(.016); t.button(8,false); t.c.update(.016);
  assert.deepEqual(t.actions,['back','start','select']);
  const g=setup(); g.button(9,true); g.c.update(.016); g.button(9,false); g.c.update(.016); g.button(8,true); g.c.update(.016);
  assert.deepEqual(g.actions,['settings','journal']);
});
