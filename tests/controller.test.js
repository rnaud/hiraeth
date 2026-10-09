import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Controller, mergeControls, stick, toPositions, padRide, triggers } from '../src/controller.js';
// positions (Standard Gamepad): 0 bottom, 1 right, 2 left, 3 top
const BOTTOM = 0, RIGHT = 1, LEFT = 2, TOP = 3, LB = 4, RB = 5, LT = 6, RT = 7, VIEW = 8, MENU = 9, L3 = 10, R3 = 11;
function setup({ faces = 'xbox', byLabel = false } = {}) {
  const pad = { index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({length:17}, () => ({pressed:false,value:0})) };
  const actions = [], moves = [], looks = [];
  let context = 'game';
  const c = new Controller({ pads: () => [pad], context: () => context, action: (a, v) => actions.push(a), look: (...v) => looks.push(v), navigate: (...v) => moves.push(v), scroll: () => {},
    faces: () => ({ faces, byLabel }) });
  return { c, pad, actions, moves, looks, context: v => context = v,
    button: (i, down, value = +down) => { pad.buttons[i] = {pressed:down,value}; },
    tap(i) { this.button(i, true); this.c.update(.016); this.button(i, false); this.c.update(.016); } };
}
test('radial deadzone removes drift and preserves analog range', () => {
  assert.deepEqual(stick(.1,.1), {x:0,y:0});
  assert.equal(stick(1,0).x,1);
  assert.ok(stick(.5,0).x > 0 && stick(.5,0).x < .5);
  assert.ok(Math.hypot(...Object.values(stick(1,1))) <= 1.000001);
});
test('walking: bottom jumps, left interacts, right evades, top uses the gadget, D-pad down drinks, R3 locks on', () => {
  const t=setup(); t.pad.axes=[.6,-1,.5,0]; [BOTTOM,LEFT].forEach(i=>t.button(i,true));
  const input=t.c.update(1/60);
  assert.ok(input.KeyW && input.KeyD && input.Space && input.KeyE && input.PadE && !input.PadEvade);
  assert.ok(input.stick.y>0 && t.looks[0][0]>0);
  assert.ok(!input.ShiftLeft, 'the stick alone walks');
  [BOTTOM,LEFT].forEach(i=>t.button(i,false));
  t.button(RIGHT,true); let h=t.c.update(.016); assert.ok(h.PadEvade && !h.KeyE, 'B / ○ evades, it does not talk'); t.button(RIGHT,false); t.c.update(.016);
  t.button(LT,true); h=t.c.update(.016); assert.ok(!h.PadEvade, 'LT alone: no evade'); t.button(RIGHT,true); assert.ok(t.c.update(.016).PadEvade, 'aiming does not change B'); t.button(RIGHT,false); t.button(LT,false); t.c.update(.016);
  t.button(TOP,true); h=t.c.update(.016); assert.ok(h.PadGadget, 'Y / △: the gadget in hand'); t.button(TOP,false); t.c.update(.016);
  assert.deepEqual(t.actions,[], 'none of these is an action: no ping, no call');
  t.tap(13); assert.deepEqual(t.actions,['potion'], 'D-pad down drinks a healing potion');
  t.tap(R3); assert.equal(t.actions.at(-1), 'lock', 'R3 locks on (main.js: with no foe in reach, the scout)');
  t.tap(12); assert.equal(t.actions.at(-1), 'lock', 'D-pad up is not an action: it chooses a gadget (PadGadgetPick)');
});
test('View: the sketchbook on release; View held + D-pad up is photo mode, + down / left / right the free chords', () => {
  const t=setup();
  t.button(VIEW,true); t.c.update(.016); assert.deepEqual(t.actions,[], 'nothing while View is held');
  t.button(VIEW,false); t.c.update(.016); assert.deepEqual(t.actions,['journal']);
  t.button(VIEW,true); t.c.update(.016); t.button(12,true); let h=t.c.update(.016);
  assert.ok(!h.PadGadgetPick, 'View + up does not choose a gadget');
  t.button(12,false); t.c.update(.016); t.button(VIEW,false); t.c.update(.016);
  assert.deepEqual(t.actions,['journal','photo'], 'a chord: no sketchbook as View is let go');
  t.button(VIEW,true); t.c.update(.016); t.tap(13); t.tap(14); t.button(15,true); h=t.c.update(.016); t.button(VIEW,false); t.button(15,false); t.c.update(.016);
  assert.deepEqual(t.actions.slice(2),['viewDown','viewLeft','viewRight'], 'no potion under View: the free chords');
  const r=setup(); r.context('ride'); r.button(VIEW,true); r.c.update(.016); r.tap(12); r.button(VIEW,false); r.c.update(.016);
  assert.deepEqual(r.actions,['photo'], 'riding too');
});
test('run: click the left stick, and you run until you let the stick go', () => {
  const t=setup(); t.pad.axes=[0,-1,0,0];
  assert.ok(!t.c.update(.016).ShiftLeft);
  t.button(L3,true); assert.ok(t.c.update(.016).ShiftLeft);
  t.button(L3,false); assert.ok(t.c.update(.016).ShiftLeft, 'still running after the click');
  t.pad.axes=[0,0,0,0]; assert.ok(!t.c.update(.016).ShiftLeft, 'the stick back to the centre: a walk again');
  t.pad.axes=[0,-1,0,0]; assert.ok(!t.c.update(.016).ShiftLeft);
});
test('L3 standing still calls the mount on its release; with the stick pushed it runs, and a run never calls', () => {
  // at rest: a click calls (on the release), and doesn't run
  const t=setup();
  t.button(L3,true); let h=t.c.update(.016); assert.ok(!h.ShiftLeft); assert.deepEqual(t.actions.filter(a=>a!=='l3'),[], 'nothing yet: it waits for the release');
  t.button(L3,false); h=t.c.update(.016); assert.deepEqual(t.actions.filter(a=>a!=='l3'),['call'], 'let go standing still: the call');
  assert.ok(!h.ShiftLeft, 'and no run');
  // moving: a click runs and never calls
  const m=setup(); m.pad.axes=[0,-1,0,0];
  m.tap(L3); assert.ok(m.c.update(.016).ShiftLeft, 'running'); assert.ok(!m.actions.includes('call'), 'a run click never whistles');
  // clicked at rest, then the stick pushed before letting go: a run after all, no call
  const p=setup();
  p.button(L3,true); p.c.update(.016); p.pad.axes=[0,-1,0,0];
  assert.ok(p.c.update(.016).ShiftLeft, 'pushed while held: it runs');
  p.button(L3,false); assert.ok(p.c.update(.016).ShiftLeft); assert.ok(!p.actions.includes('call'), 'no call');
  // held long at rest: not a click, no call
  const l=setup(); l.button(L3,true); for (let i=0;i<40;i++) l.c.update(.016); l.button(L3,false); l.c.update(.016);
  assert.ok(!l.actions.includes('call'), 'held over half a second: no call');
  // L3 + R3 (the hitboxes): no call
  const b=setup(); b.button(L3,true); b.c.update(.016); b.button(R3,true); b.c.update(.016); b.button(R3,false); b.button(L3,false); b.c.update(.016);
  assert.ok(b.actions.includes('hitboxes') && !b.actions.includes('call'), 'L3 + R3: the hitboxes, no whistle');
  // riding: L3 boosts, never calls
  const r=setup(); r.context('ride'); r.c.update(.016); r.tap(L3); assert.ok(!r.actions.includes('call'), 'riding: no call');
});
test('the gadget wheel open: the right stick goes to the wheel (its gun modes), not the camera', () => {
  let open=false;
  const pad = { index: 0, connected: true, mapping: 'standard', axes: [0, 0, 1, 0], buttons: Array.from({length:17}, () => ({pressed:false,value:0})) };
  const looks=[];
  const c = new Controller({ pads: () => [pad], context: () => 'game', action() {}, look: (x, y) => looks.push([x, y]), navigate() {}, scroll() {}, wheel: () => open });
  let h=c.update(.016); assert.ok(looks.length===1 && !h.rstick, 'closed: the right stick looks');
  open=true; h=c.update(.016); assert.equal(looks.length, 1, 'open: no look'); assert.ok(h.rstick.x > 0.9, 'the stick goes to the wheel');
  assert.deepEqual(mergeControls({}, h).rstick, h.rstick, 'merged as the left stick is');
});
test('disconnect and background clear controls without releasing keyboard input', () => {
  const t=setup(); t.button(0,true); assert.ok(t.c.update(.016).Space);
  assert.deepEqual(t.c.update(.016,false),{});
  t.pad.connected=false; assert.deepEqual(t.c.update(.016),{});
  assert.ok(mergeControls({Space:true}, {Space:false}).Space);
  assert.deepEqual(mergeControls({stick:{x:.5,y:0}}, {stick:{x:0,y:0}}).stick,{x:.5,y:0});
  assert.equal(mergeControls({}, {Throttle:.4}).Throttle, .4, 'analog values stay analog');
});
test('confirm does not become a jump when returning to play', () => {
  const t=setup(); t.context('menu'); t.button(0,true); t.c.update(.016);
  assert.deepEqual(t.actions,['confirm']);
  t.context('game'); assert.equal(t.c.update(.016).Space,false);
  t.button(0,false); t.c.update(.016); t.button(0,true);
  assert.equal(t.c.update(.016).Space,true);
});
test('menus: printed A confirms and B goes back, wherever the pad prints them', () => {
  const x=setup(); x.context('menu'); x.tap(BOTTOM); x.tap(RIGHT); x.tap(VIEW); x.tap(MENU);
  assert.deepEqual(x.actions,['confirm','back','select','start'], 'Xbox: A at the bottom confirms, B on the right goes back; View / Menu are the full-screen menus');
  const n=setup({ faces: 'nintendo' }); n.context('menu'); n.tap(RIGHT); n.tap(BOTTOM);
  assert.deepEqual(n.actions,['confirm','back'], 'Retroid: A on the right confirms, B at the bottom goes back');
  // talking: the interact button (left, X / □) carries the conversation on; B goes back as in every menu
  const xt=setup(); xt.context('talk'); xt.tap(LEFT); xt.tap(BOTTOM); xt.tap(RIGHT); xt.tap(MENU);
  assert.deepEqual(xt.actions,['confirm','confirm','back','start'], '(Menu pauses over a conversation)');
  const nt=setup({ faces: 'nintendo' }); nt.context('talk'); nt.tap(RIGHT); nt.tap(BOTTOM); nt.tap(LEFT);
  assert.deepEqual(nt.actions,['confirm','back','confirm']);
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
  const v=setup(); v.context('photo'); v.tap(VIEW); v.tap(13); assert.deepEqual(v.actions,['photo'], 'View leaves too; D-pad down no longer does');
});
test('the fluid tool: LT aims, RT shoots only while aiming (else the jets), RB swings the blade, the D-pad changes the mode', () => {
  const t=setup(); t.button(RT,true);
  let input=t.c.update(.016);
  assert.ok(input.PadFire && !input.PadAim && !input.ShiftLeft, 'RT alone: no run');
  assert.deepEqual(triggers(input), { aim: false, fire: true, shoot: false, jets: true, thrust: 1, quick: false }, 'RT alone fires the jets, it does not shoot');
  t.button(LT,true); input=t.c.update(.016);
  assert.ok(input.PadAim && input.PadFire);
  assert.deepEqual(triggers(input), { aim: true, fire: true, shoot: true, jets: false, thrust: 0, quick: false }, 'LT held: RT shoots, the jets are off');
  t.button(BOTTOM,true); input=t.c.update(.016);
  assert.ok(input.Space && input.PadJump, 'the jump is marked as the pad\'s (it never fires the jets)');
  t.button(RB,true); input=t.c.update(.016); assert.ok(input.PadBlade && !input.PadPush, 'RB swings the blade (the push is a gun mode)');
  t.button(LB,true); assert.ok(t.c.update(.016).PadGuard, 'LB held: the guard');
  const b=setup(); b.button(LEFT,true); input=b.c.update(.016);
  assert.ok(!input.PadPush && input.KeyE, 'the left button interacts, it does not push');
  b.button(LEFT,false); b.c.update(.016); b.tap(14); b.tap(15);
  assert.deepEqual(b.actions, [], 'D-pad left / right: free (the gun mode is D-pad up while aiming: src/gadgets/index.js)');
  b.button(LT,true); b.button(12,true); input=b.c.update(.016);
  assert.ok(input.PadAim && input.PadGadgetPick, 'LT + D-pad up: the chooser, aiming (a tap: the next gun mode)');
  // a light squeeze of LT is enough to aim
  const s=setup(); s.pad.buttons[LT]={pressed:false,value:.35}; assert.ok(s.c.update(.016).PadAim);
  // no aiming or firing from menus
  const m=setup(); m.context('menu'); [LT,RT,RB].forEach(i=>m.button(i,true)); assert.deepEqual(m.c.update(.016),{});
  assert.ok(mergeControls({KeyR:true},{PadAim:false}).KeyR);
  assert.ok(mergeControls({},{PadFire:true}).PadFire);
});
test('the mouse and keys: right aims, left shoots while aiming (and swings the blade otherwise: fluid-tool.js); G shoots only while aiming', () => {
  assert.deepEqual(triggers({ MouseLeft: true }), { aim: false, fire: true, shoot: false, jets: false, thrust: 0, quick: false }, 'the left button is not the jets');
  assert.deepEqual(triggers({ MouseLeft: true, MouseRight: true }), { aim: true, fire: true, shoot: true, jets: false, thrust: 0, quick: false });
  assert.deepEqual(triggers({ KeyG: true }), { aim: false, fire: true, shoot: false, jets: false, thrust: 0, quick: false }, 'G alone: nothing (G is not the jets)');
  assert.deepEqual(triggers({ KeyR: true, KeyG: true }), { aim: true, fire: true, shoot: true, jets: false, thrust: 0, quick: false });
  assert.equal(triggers({ Space: true }).jets, false, 'Space is the jets in player.js itself, as before');
  assert.equal(triggers({ TouchFire: true }).quick, true, 'the touch button: a quick shot that aims for you');
});
test('LB held: the right stick zooms instead of looking', () => {
  const t=setup(); t.button(LB,true); t.pad.axes=[0,0,0,.8];
  t.c.update(.016);
  assert.deepEqual(t.actions,['zoomOut']); assert.equal(t.looks.length,0);
  t.pad.axes=[0,0,0,-.8]; t.c.update(.016); assert.equal(t.actions.at(-1),'zoomIn');
});
test('in a fight LB blocks and the right stick only looks: no zoom', () => {
  const t=setup(); t.c.combat = () => true;
  t.button(LB,true); t.pad.axes=[0,0,0,.8]; t.c.update(.016);
  assert.ok(!t.actions.includes('zoomOut') && t.looks.length > 0);
});

test('riding: RT is an analog throttle, LT brakes, the stick steers and tilts but never drives on', () => {
  const t=setup(); t.context('ride');
  t.button(RT,true,.5); t.pad.axes=[-.7,-.8,0,0];
  let h=t.c.update(.016);
  assert.ok(h.PadRide && h.Throttle > .4 && h.Throttle < .6, `half a squeeze, half the throttle (${h.Throttle})`);
  assert.ok(!h.KeyW && !h.KeyA, 'the stick is not W/A while riding');
  assert.ok(h.stick.x < -.5 && h.stick.y > .5);
  assert.ok(!h.PadFire && !h.PadAim, 'the triggers drive, they do not shoot');
  const r=padRide(h); assert.ok(r.throttle > .4 && r.x < -.5 && r.y > .5 && !r.boost);
  t.button(LT,true,1); t.button(RB,true); t.button(BOTTOM,true); t.button(RIGHT,true);
  h=t.c.update(.016);
  assert.ok(h.Brake > .9 && h.Boost && h.JumpOff && h.KeyE);
  assert.ok(!h.Space, 'the bottom button jumps off: the hop / flap / rise is the left button now');
  t.button(LEFT,true); assert.ok(t.c.update(.016).Space, 'left: hop, flap, rise');
  assert.equal(padRide({ KeyW: true }), null, 'keyboard riding is untouched');
  // stepping off with RT still held: it does not fire as you land
  t.context('game'); [LT,RB,BOTTOM,RIGHT,LEFT].forEach(i=>t.button(i,false));
  assert.ok(!t.c.update(.016).PadFire, 'the held RT is ignored until released');
  t.button(RT,false); t.c.update(.016); t.button(RT,true); assert.ok(t.c.update(.016).PadFire);
});
test('a pad reporting printed letters with Nintendo labels is read by position', () => {
  assert.deepEqual(toPositions(['A','B','X','Y','LB']), ['B','A','Y','X','LB']);
  // Android, the Retroid: index 1 is KEYCODE_BUTTON_B, the bottom button
  const t=setup({ faces: 'nintendo', byLabel: true });
  t.button(1,true); let h=t.c.update(.016);
  assert.ok(h.Space && !h.KeyE, 'printed B (bottom) jumps');
  t.button(1,false); t.button(3,true); h=t.c.update(.016);
  assert.ok(h.KeyE && !h.Space, 'printed Y (left) interacts');
  t.button(3,false); t.button(0,true); h=t.c.update(.016);
  assert.ok(h.PadEvade && !h.KeyE, 'printed A (right) evades');
  t.button(0,false); t.button(2,true); h=t.c.update(.016);
  assert.ok(h.PadGadget, 'printed X (top): the gadget');
  t.button(2,false); t.c.update(.016);
  t.context('menu'); t.tap(0); t.tap(1);
  assert.deepEqual(t.actions,['confirm','back'], 'menus: printed A confirms, printed B goes back');
});

test('in menus B steps back, Menu / Start and View / Select reach the game (pause menu, sketchbook)', () => {
  const t=setup(); t.context('menu');
  t.button(1,true); t.c.update(.016); t.button(1,false); t.c.update(.016);
  t.button(9,true); t.c.update(.016); t.button(9,false); t.c.update(.016);
  t.button(8,true); t.c.update(.016); t.button(8,false); t.c.update(.016);
  assert.deepEqual(t.actions,['back','start','select']);
  const g=setup(); g.button(9,true); g.c.update(.016); g.button(9,false); g.c.update(.016); g.button(8,true); g.c.update(.016); g.button(8,false); g.c.update(.016);
  assert.deepEqual(g.actions,['settings','journal'], '(View opens the sketchbook as it is let go)');
});
